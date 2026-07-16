export function getAdvisorActivationUrl(): string {
  const url = process.env.ADVISOR_ACTIVATION_URL;
  
  if (!url) {
    // Enable local fallback ONLY during emulator local testing
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      return "http://localhost:5173/activate-advisor";
    }
    throw new Error("La variable de entorno ADVISOR_ACTIVATION_URL no está configurada en el servidor.");
  }

  // Validate HTTPS requirement
  if (!url.startsWith("https://")) {
    throw new Error("Error de configuración: ADVISOR_ACTIVATION_URL debe utilizar el protocolo HTTPS obligatorio.");
  }

  // Validate Aura owned domain
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    if (!hostname.endsWith("auranexus.io") && !hostname.endsWith("aurahcm.com")) {
      throw new Error("Error de configuración: ADVISOR_ACTIVATION_URL debe pertenecer a un dominio oficial de Aura (auranexus.io o aurahcm.com).");
    }
  } catch (err: any) {
    throw new Error("Error de configuración: ADVISOR_ACTIVATION_URL no es una URL válida: " + err.message);
  }

  return url;
}
