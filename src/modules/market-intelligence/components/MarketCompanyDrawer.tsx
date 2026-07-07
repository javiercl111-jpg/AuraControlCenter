import {
  Building2,
  Calendar,
  CheckCircle2,
  FileCheck,
  Globe,
  Hash,
  Info,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import type { CompanyStatus, InegiCompany } from "../types/inegi";
import { resolveCommercialIndustry } from "../services/industryResolverService";
import { Link } from "react-router-dom";
import AuraSalesAdvisorPanel from "./AuraSalesAdvisorPanel";

interface MarketCompanyDrawerProps {
  company: InegiCompany | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: CompanyStatus) => Promise<void>;
  onConvert: () => Promise<void>;
  isProcessing: boolean;
  canUpdate: boolean;
  canConvert: boolean;
}

export default function MarketCompanyDrawer({
  company,
  isOpen,
  onClose,
  onStatusChange,
  onConvert,
  isProcessing,
  canUpdate,
  canConvert,
}: MarketCompanyDrawerProps) {
  if (!isOpen || !company) return null;

  const score = company.opportunityScore;
  const breakdown = company.scoreBreakdown;



  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Body */}
      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-950 p-6 shadow-2xl transition-all duration-300 md:p-8 overflow-y-auto">
        
        {/* Header Drawer */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
              <Hash className="h-3 w-3" /> Deterministic ID
            </span>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {company.nombreComercial || company.razonSocial}
            </h2>
            {company.razonSocial && company.nombreComercial && (
              <p className="text-xs text-slate-500 mt-1">{company.razonSocial}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-8 py-6">
          


          {/* Ficha Rápida Estatus & Score */}
          <div className="grid gap-4 sm:grid-cols-2">
            
            {/* Medidor Aura Opportunity Score */}
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
              <div className="flex items-center gap-2 text-cyan-300">
                <Sparkles className="h-4.5 w-4.5" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Opportunity Score Aura
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white">{score}</span>
                <span className="text-sm font-semibold text-cyan-400">/ 100 pts</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Afinidad y probabilidad de conversión a ecosistema de Software Aura.
              </p>
            </div>

            {/* Selector de Estatus */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Estatus de Prospección
              </div>
              
              <div className="mt-3">
                {company.status === "CONVERTED" ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase">CONVERTIDO EN AURA</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(["NEW", "QUALIFIED", "CONTACTED", "DISCARDED"] as CompanyStatus[]).map((st) => {
                      const active = company.status === st;
                      const labelMap: Record<CompanyStatus, string> = {
                        NEW: "Nuevo",
                        QUALIFIED: "Calificado",
                        CONTACTED: "Contactar",
                        DISCARDED: "Descartar",
                        CONVERTED: "Convertido",
                      };
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onStatusChange(st)}
                          disabled={isProcessing || !canUpdate}
                          title={!canUpdate ? "No tienes permisos para modificar estatus" : ""}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            active
                              ? "bg-cyan-400 border-cyan-400 text-slate-950 font-bold"
                              : "border-slate-800 bg-slate-900/55 text-slate-400 hover:border-slate-700 hover:text-white"
                          }`}
                        >
                          {labelMap[st]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Aura Sales Advisor */}
          <AuraSalesAdvisorPanel company={company} />

          {/* Desglose del Scoring */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5">
            <h3 className="text-sm font-semibold tracking-wide text-white mb-4 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-cyan-400" />
              Desglose de Calificación Aura
            </h3>
            
            <div className="space-y-3.5 text-xs">
              {/* Score INEGI */}
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Base Score INEGI (Peso 25%)</span>
                  <span className="font-semibold text-slate-200">{breakdown.sourceScore} / 25 pts</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${(breakdown.sourceScore / 25) * 100}%` }} />
                </div>
              </div>

              {/* Tamaño */}
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Tamaño Corporativo ({company.tamano}) (Peso 20%)</span>
                  <span className="font-semibold text-slate-200">{breakdown.companySizeScore} / 20 pts</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${(breakdown.companySizeScore / 20) * 100}%` }} />
                </div>
              </div>

              {/* Sector */}
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Afinidad del Sector SCIAN (Peso 20%)</span>
                  <span className="font-semibold text-slate-200">{breakdown.sectorScore} / 20 pts</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${(breakdown.sectorScore / 20) * 100}%` }} />
                </div>
              </div>

              {/* Contactos */}
              <div>
                <div className="flex justify-between text-slate-400">
                  <span>Canales de Contacto Disponibles (Peso 35%)</span>
                  <span className="font-semibold text-slate-200">{breakdown.reachabilityScore} / 35 pts</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${(breakdown.reachabilityScore / 35) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>





          {/* Datos Generales / Ficha Técnica */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-5 space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-white flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-cyan-400" />
              Ficha Técnica DENUE 2026
            </h3>
            
            <div className="grid gap-4 text-xs sm:grid-cols-2">
              <div>
                <span className="block text-slate-500">Sector Económico</span>
                <span className="mt-1 block font-medium text-slate-300">{resolveCommercialIndustry(company.sector) || "N/A"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Actividad Económica</span>
                <span className="mt-1 block font-medium text-slate-300">{company.actividad || "N/A"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Rango de Personal</span>
                <span className="mt-1 block font-medium text-slate-300">{company.rangoPersonal || "N/A"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Clase SCIAN</span>
                <span className="mt-1 block font-medium text-slate-300 font-mono text-cyan-300">{company.scian || "N/A"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Alta en DENUE</span>
                <span className="mt-1 block font-medium text-slate-300 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-600" />
                  {company.altaDenue || "N/A"}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">Coordenadas Geográficas</span>
                <span className="mt-1 block font-medium text-slate-300">
                  {company.latitud ? `${company.latitud}, ${company.longitud}` : "N/A"}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-800/60 pt-4 space-y-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>{company.direccion}, {company.municipio}, C.P. {company.cp}</span>
              </div>
              {company.email && (
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Mail className="h-4 w-4 text-cyan-400 shrink-0" />
                  <a href={`mailto:${company.email}`} className="hover:underline text-cyan-300">
                    {company.email}
                  </a>
                </div>
              )}
              {company.telefono && (
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Phone className="h-4 w-4 text-cyan-400 shrink-0" />
                  <a href={`tel:${company.telefono}`} className="hover:underline text-cyan-300">
                    {company.telefono}
                  </a>
                </div>
              )}
              {company.sitioWeb &&
                company.sitioWeb !== "no disponible" &&
                company.sitioWeb !== "n/a" && (
                  <div className="flex items-center gap-2.5 text-xs text-slate-300">
                    <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                    <a
                      href={company.sitioWeb.startsWith("http") ? company.sitioWeb : `https://${company.sitioWeb}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-cyan-300 truncate"
                    >
                      {company.sitioWeb}
                    </a>
                  </div>
                )}
            </div>
          </div>

        </div>

        {/* Acciones del pie */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          {company.status === "CONVERTED" ? (
            <Link
              to="/consulting"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-3.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all duration-200"
            >
              <UserCheck className="h-4 w-4" />
              Ver en Consulting Center
            </Link>
          ) : (
            <button
              type="button"
              onClick={onConvert}
              disabled={isProcessing || !canConvert}
              title={!canConvert ? "No tienes permisos para convertir prospectos" : ""}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
              ) : (
                <FileCheck className="h-4 w-4" />
              )}
              Convertir en Organización Consultiva
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
