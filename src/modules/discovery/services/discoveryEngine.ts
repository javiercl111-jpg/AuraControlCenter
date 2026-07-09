import type { QuestionStep, AuraThoughtState } from "../types/discoveryTypes";

export const DISCOVERY_QUESTIONS: QuestionStep[] = [
  {
    id: "sector",
    text: "Para comenzar, ¿cuál es el sector principal en el que opera tu organización?",
    inputType: "choice",
    options: [
      { value: "Restaurantes y Alimentos", label: "Restaurantes y Alimentos" },
      { value: "Hoteles y Hospedaje", label: "Hoteles y Hospedaje" },
      { value: "Servicios Financieros", label: "Servicios Financieros y Seguros" },
      { value: "Manufactura e Industria", label: "Manufactura e Industria" },
      { value: "Comercio", label: "Comercio y Retail" },
      { value: "Otros", label: "Otros Sectores / Servicios" },
    ],
  },
  {
    id: "employees_method",
    text: "¿Cuántos colaboradores activos tienen actualmente y qué método utilizan principal o parcialmente para programar sus turnos y horarios?",
    inputType: "choice",
    options: [
      { value: "Micro_Manual", label: "Menos de 10 personas, Excel y papel" },
      { value: "Pyme_Manual", label: "10 a 50 personas, Excel y papel" },
      { value: "Mediana_Local", label: "51 a 250 personas, Software local o ERP" },
      { value: "Grande_Cloud", label: "Más de 250 personas, Sistema en la nube" },
    ],
  },
  {
    id: "payroll_issues",
    text: "Llevar asistencia y turnos manualmente o en sistemas aislados suele generar discrepancias al pagar nómina. ¿Han tenido quejas o incidencias por errores en pagos, horas extras o primas en los últimos meses?",
    inputType: "choice",
    options: [
      { value: "Si_Frecuente", label: "Sí, frecuentemente tenemos quejas o desacuerdos" },
      { value: "Ocasional_Lento", label: "Ocasionalmente, y nos toma bastante tiempo conciliar" },
      { value: "No_Perfecto", label: "No, nuestros registros son sumamente precisos" },
    ],
  },
  {
    id: "priority",
    text: "Para finalizar tu expediente y preparar tu Radiografía Empresarial Aura™, ¿cuál es tu principal prioridad estratégica para los próximos 3 meses?",
    inputType: "choice",
    options: [
      { value: "Errores_Pago", label: "Reducir errores en pre-nómina y cálculo de horas extras" },
      { value: "Control_Asistencia", label: "Automatizar la asignación de turnos y control de asistencia" },
      { value: "Rotacion_Clima", label: "Reducir la rotación y mejorar el clima laboral" },
      { value: "Digitalizar_Expedientes", label: "Digitalizar expedientes, contratos y solicitudes de vacaciones" },
    ],
  },
];

/**
 * Calcula en tiempo real el pensamiento de la IA (Aura Thoughts) y el nivel de confianza
 * basándose en las respuestas acumuladas en el Discovery Portal.
 */
export function getAuraThoughts(answers: Record<string, string>): AuraThoughtState {
  const sector = answers["sector"];
  const empMethod = answers["employees_method"];
  const payrollIssues = answers["payroll_issues"];
  const priority = answers["priority"];

  if (!sector) {
    return {
      hypothesis: "Analizando canal de prospección. Esperando sector industrial para formular hipótesis operativa inicial.",
      confidence: 15,
      nextSteps: "Identificar el giro comercial principal del prospecto.",
    };
  }

  if (!empMethod) {
    let focus = "estructuras generales de RRHH";
    if (sector.includes("Alimentos") || sector.includes("Hoteles")) {
      focus = "esquemas de alta rotación, cuadrantes dinámicos y multisucursales";
    } else if (sector.includes("Manufactura")) {
      focus = "turnos rotativos continuos de 24/7 y primas dominicales";
    }

    return {
      hypothesis: `Estableciendo base para sector "${sector}". Evaluando hipótesis sobre ${focus}.`,
      confidence: 45,
      nextSteps: "Determinar volumen de colaboradores y nivel de digitalización de cuadrantes.",
    };
  }

  if (!payrollIssues) {
    const isManual = empMethod.includes("Manual");
    const size = empMethod.includes("Micro") ? "Micro" : empMethod.includes("Pyme") ? "Pyme" : empMethod.includes("Mediana") ? "Mediana" : "Grande";
    
    let message = "";
    let conf = 65;
    if (isManual) {
      message = `Nivel de digitalización clasificado como MANUAL para empresa de tamaño ${size}. Existe una probabilidad estimada del 82% de fugas financieras por cálculos manuales de horas extras.`;
      conf = 75;
    } else {
      message = `Nivel de digitalización clasificado como SISTEMA LOCAL/NUBE para empresa de tamaño ${size}. Investigando brechas en la integración entre el control de asistencia y el ERP de nómina.`;
      conf = 70;
    }

    return {
      hypothesis: message,
      confidence: conf,
      nextSteps: "Confirmar índice de quejas por pagos de horas extras o primas devengadas.",
    };
  }

  if (!priority) {
    const isManual = empMethod.includes("Manual");
    const hasIssues = payrollIssues !== "No_Perfecto";
    
    let message = "";
    let conf = 85;
    if (isManual && hasIssues) {
      message = "Hipótesis confirmada: Procesos manuales provocan discrepancias directas en la nómina. Foco prioritario recomendado en automatización de turnos e integración nativa de pre-nómina.";
      conf = 90;
    } else if (hasIssues) {
      message = "Fuga financiera detectada por falta de integración en tiempo real. Aunque disponen de software, la conciliación manual de incidencias sigue generando retrasos y errores.";
      conf = 88;
    } else {
      message = "Procesos estables pero susceptibles a ineficiencias de control. Evaluando oportunidades de automatización para liberar carga administrativa en el equipo directivo.";
      conf = 82;
    }

    return {
      hypothesis: message,
      confidence: conf,
      nextSteps: "Identificar prioridad de negocio para perfilar el mapa de ruta tecnológico Aura.",
    };
  }

  // Finalizado
  return {
    hypothesis: `Análisis finalizado para sector "${sector}" de tamaño ${
      empMethod.includes("Micro") ? "<10" : empMethod.includes("Pyme") ? "10-50" : empMethod.includes("Mediana") ? "51-250" : ">250"
    } colaboradores. Recomendación idónea trazada en función de su prioridad principal: "${priority}".`,
    confidence: 98,
    nextSteps: "Radiografía Empresarial lista para ser revisada por el consultor asignado.",
  };
}

const DiscoveryEngine = {
  DISCOVERY_QUESTIONS,
  getAuraThoughts,
};

export default DiscoveryEngine;
