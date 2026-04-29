import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { RefreshCw } from "lucide-react";

function hasVisibleModalInDom() {
  if (typeof document === "undefined") return false;
  const nodes = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
  return nodes.some((node) => {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (style.position !== "fixed") return false;

    const zIndex = Number(style.zIndex);
    if (!Number.isFinite(zIndex) || zIndex < 40) return false;

    const rect = node.getBoundingClientRect();
    if (rect.width < 220 || rect.height < 120) return false;

    const className = typeof node.className === "string" ? node.className : "";
    return className.includes("inset-0") || rect.width >= window.innerWidth * 0.35;
  });
}

export default function ModalRefreshButton() {
  const location = useLocation();
  const [hasOpenModal, setHasOpenModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const routeEvents = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path === "/" || path === "/panel" || path === "/clientes") {
      return ["modal-refresh", "refreshClients", "clients-updated"];
    }
    if (path === "/tareas") return ["modal-refresh", "refreshTasks"];
    if (path === "/reportes") return ["modal-refresh", "refreshReports"];
    if (path === "/tarifas") return ["modal-refresh", "refreshTarifas"];
    return ["modal-refresh"];
  }, [location.pathname]);

  useEffect(() => {
    const updateState = () => setHasOpenModal(hasVisibleModalInDom());
    updateState();

    const observer = new MutationObserver(() => updateState());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", updateState);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateState);
    };
  }, [location.pathname]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    routeEvents.forEach((eventName) => {
      window.dispatchEvent(new CustomEvent(eventName, { detail: { path: location.pathname, source: "modal-button" } }));
    });
    window.setTimeout(() => setRefreshing(false), 900);
  }, [location.pathname, routeEvents]);

  if (!hasOpenModal) return null;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      className="fixed right-5 top-24 z-[10001] inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur hover:bg-emerald-400 disabled:opacity-70"
      title="Refrescar datos de la modal"
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      {refreshing ? "Refrescando..." : "Refrescar"}
    </button>
  );
}
