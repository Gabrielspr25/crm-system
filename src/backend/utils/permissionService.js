import {
    PERMISSION_CATALOG,
    PERMISSION_KEYS,
    groupPermissionCatalog,
    normalizePermissionKey,
    normalizeRoleName,
    roleHasDefaultPermission
} from '../../shared/permissionCatalog.js';

export const PERMISSION_EFFECTS = new Set(['allow', 'deny', 'inherit']);

export const normalizePermissionEffect = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return PERMISSION_EFFECTS.has(normalized) ? normalized : 'inherit';
};

export const ensurePermissionSchema = async (queryFn) => {
    await queryFn(`
        CREATE TABLE IF NOT EXISTS user_permission_overrides (
            user_id TEXT NOT NULL,
            permission_key TEXT NOT NULL,
            effect TEXT NOT NULL DEFAULT 'inherit',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by TEXT NULL,
            PRIMARY KEY (user_id, permission_key),
            CONSTRAINT user_permission_overrides_effect_chk CHECK (effect IN ('allow', 'deny', 'inherit'))
        )
    `);

    await queryFn(`
        CREATE INDEX IF NOT EXISTS user_permission_overrides_user_idx
        ON user_permission_overrides(user_id, effect)
    `);
};

export const getPermissionCatalogResponse = () => ({
    permissions: PERMISSION_CATALOG,
    grouped: groupPermissionCatalog()
});

export const getUserPermissionOverrides = async (queryFn, userId) => {
    if (!String(userId || '').trim()) return {};

    await ensurePermissionSchema(queryFn);

    const rows = await queryFn(
        `SELECT permission_key, effect, updated_at, updated_by
           FROM user_permission_overrides
          WHERE user_id::text = $1
          ORDER BY permission_key ASC`,
        [String(userId).trim()]
    );

    return rows.reduce((accumulator, row) => {
        const key = normalizePermissionKey(row.permission_key);
        if (!PERMISSION_KEYS.has(key)) return accumulator;
        accumulator[key] = {
            effect: normalizePermissionEffect(row.effect),
            updated_at: row.updated_at || null,
            updated_by: row.updated_by ? String(row.updated_by) : null
        };
        return accumulator;
    }, {});
};

export const resolvePermissionMap = (role, overrides = {}) => {
    const normalizedRole = normalizeRoleName(role);
    return PERMISSION_CATALOG.reduce((accumulator, permission) => {
        const override = overrides[permission.key];
        const effect = normalizePermissionEffect(override?.effect);
        const allowed = effect === 'allow'
            ? true
            : effect === 'deny'
                ? false
                : roleHasDefaultPermission(normalizedRole, permission.key);

        accumulator[permission.key] = {
            allowed,
            source: effect === 'inherit' ? 'role' : 'override',
            effect,
            role_default: roleHasDefaultPermission(normalizedRole, permission.key)
        };
        return accumulator;
    }, {});
};

export const resolvePermissionsForUser = async (queryFn, user) => {
    const userId = String(user?.userId || user?.id || '').trim();
    const role = normalizeRoleName(user?.role);
    const overrides = await getUserPermissionOverrides(queryFn, userId);
    return {
        user_id: userId || null,
        role,
        overrides,
        permissions: resolvePermissionMap(role, overrides)
    };
};

export const userHasPermission = async (queryFn, user, permissionKey) => {
    const normalizedKey = normalizePermissionKey(permissionKey);
    if (!PERMISSION_KEYS.has(normalizedKey)) {
        return false;
    }
    const resolved = await resolvePermissionsForUser(queryFn, user);
    return Boolean(resolved.permissions[normalizedKey]?.allowed);
};

export const saveUserPermissionOverrides = async (queryFn, actorUserId, targetUserId, items = []) => {
    const normalizedTargetUserId = String(targetUserId || '').trim();
    if (!normalizedTargetUserId) {
        throw new Error('user_id es requerido');
    }

    await ensurePermissionSchema(queryFn);

    for (const item of Array.isArray(items) ? items : []) {
        const permissionKey = normalizePermissionKey(item?.permission_key);
        const effect = normalizePermissionEffect(item?.effect);

        if (!PERMISSION_KEYS.has(permissionKey)) {
            continue;
        }

        await queryFn(
            `INSERT INTO user_permission_overrides (user_id, permission_key, effect, updated_at, updated_by)
             VALUES ($1, $2, $3, NOW(), $4)
             ON CONFLICT (user_id, permission_key)
             DO UPDATE SET
               effect = EXCLUDED.effect,
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by`,
            [
                normalizedTargetUserId,
                permissionKey,
                effect,
                actorUserId ? String(actorUserId) : null
            ]
        );
    }

    return getUserPermissionOverrides(queryFn, normalizedTargetUserId);
};
