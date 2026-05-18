// Cálculo de días hábiles (L-V) para metas y cuotas diarias.
// TODO: integrar feriados de Puerto Rico cuando exista tabla holidays.

function isBusinessDay(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}

function startOfDay(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return d;
}

export function businessDaysBetween(start, end) {
    const a = startOfDay(start);
    const b = startOfDay(end);
    if (a > b) return 0;
    let count = 0;
    const cursor = new Date(a);
    while (cursor <= b) {
        if (isBusinessDay(cursor)) count += 1;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

export function businessDaysInMonth(year, month) {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    return businessDaysBetween(first, last);
}

export function businessDaysRemaining(today, year, month) {
    const last = new Date(year, month, 0);
    const ref = startOfDay(today);
    if (ref > last) return 0;
    const start = ref.getFullYear() === year && ref.getMonth() + 1 === month ? ref : new Date(year, month - 1, 1);
    return businessDaysBetween(start, last);
}

export function businessDaysElapsed(today, year, month) {
    const first = new Date(year, month - 1, 1);
    const ref = startOfDay(today);
    if (ref < first) return 0;
    const last = new Date(year, month, 0);
    const end = ref > last ? last : ref;
    const dayBefore = new Date(end);
    dayBefore.setDate(dayBefore.getDate() - 1);
    if (dayBefore < first) return 0;
    return businessDaysBetween(first, dayBefore);
}
