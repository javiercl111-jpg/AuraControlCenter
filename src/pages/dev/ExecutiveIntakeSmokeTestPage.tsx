import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

export default function ExecutiveIntakeSmokeTestPage() {
  const [commercialCode, setCommercialCode] = useState('SMOKETEST');
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState<string | null>(null);
  
  // Use a fixed idempotency key for test reproducibility unless changed
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleResolveAdvisor = async () => {
    setLoading(true);
    addLog(`Testing resolveAdvisorByCode for code: ${commercialCode}`);
    try {
      const resolveAdvisorFn = httpsCallable(functions, 'resolveAdvisorByCode');
      const response = await resolveAdvisorFn({ commercialCode });
      const data = response.data as any;
      addLog(`Status: ${data.status}`);
      addLog(`Display Name: ${data.advisorDisplayName || 'N/A'}`);
      addLog(`Public Message: ${data.publicMessage}`);
    } catch (error: any) {
      addLog(`Error: ${error.code} - ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async (alterPayload = false) => {
    setLoading(true);
    addLog(`Testing createDiscoveryLead (Key: ${idempotencyKey})`);
    try {
      const createLeadFn = httpsCallable(functions, 'createDiscoveryLead');
      const payload = {
        companyName: alterPayload ? "Aura QA Executive Intake ALTERED" : "Aura QA Executive Intake",
        contactName: "Prospecto de Prueba",
        jobTitle: "Dirección General",
        email: "test.qa@auranexus.io",
        state: "Querétaro",
        city: "Querétaro",
        employeeRange: "11-50",
        origin: "WEBSITE",
        acquisitionSource: "AURA_NEXUS",
        privacyConsent: true,
        diagnosticDeliveryConsent: true,
        followUpConsent: false,
        marketingConsent: false,
        policyVersion: "qa-launch-readiness-v1",
        idempotencyKey: idempotencyKey,
      };

      const response = await createLeadFn(payload);
      const data = response.data as any;
      
      addLog(`Status: ${data.status}`);
      addLog(`Next Action: ${data.nextAction}`);
      addLog(`Public Message: ${data.publicMessage || 'N/A'}`);
      addLog(`Organization Profile: ${data.organizationProfile}`);
      addLog(`Requires Manual Review: ${data.requiresManualReview}`);
      addLog(`Advisor Display Name: ${data.advisorDisplayName || 'N/A'}`);
      addLog(`Retry After Seconds: ${data.retryAfterSeconds || 'N/A'}`);
      addLog(`Discovery URL present: ${data.discoveryUrl ? 'Yes' : 'No'}`);
      
      if (data.discoveryUrl) {
        setDiscoveryUrl(data.discoveryUrl);
      }
    } catch (error: any) {
      addLog(`Error: ${error.code} - ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDiscovery = () => {
    if (discoveryUrl) {
      addLog(`Opening discovery URL in new tab...`);
      window.open(discoveryUrl, '_blank');
    }
  };

  const handleResetKey = () => {
    const newKey = crypto.randomUUID();
    setIdempotencyKey(newKey);
    addLog(`New Idempotency Key generated: ${newKey}`);
  };

  if (!import.meta.env.DEV) {
    return <div className="p-10 text-red-500 font-bold">ACCESO DENEGADO. RUTA SÓLO DE DESARROLLO.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen text-gray-800">
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-8">
        <h1 className="text-xl font-bold text-yellow-700">ENTORNO DE PRUEBA — NO USAR DATOS REALES</h1>
        <p className="text-yellow-600">
          Executive Intake Real Integration Smoke Test Harness.<br/>
          Debug Provider Token debe estar registrado en Firebase Console para que App Check funcione localmente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-blue-600">1. Resolve Advisor By Code</h2>
            <div className="flex space-x-2">
              <input 
                type="text" 
                value={commercialCode} 
                onChange={e => setCommercialCode(e.target.value)}
                className="border p-2 rounded flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Código Comercial"
              />
              <button 
                onClick={handleResolveAdvisor} 
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Test
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-emerald-600">2. Create Discovery Lead</h2>
            <div className="mb-4">
              <label className="text-xs text-gray-500 font-mono block mb-1">Idempotency Key (UUID)</label>
              <div className="flex items-center justify-between bg-gray-100 p-2 rounded font-mono text-sm">
                <span>{idempotencyKey}</span>
                <button onClick={handleResetKey} className="text-gray-500 hover:text-black">↺</button>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2">
              <button 
                onClick={() => handleCreateLead(false)} 
                disabled={loading}
                className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                Test (Same Payload)
              </button>
              <button 
                onClick={() => handleCreateLead(true)} 
                disabled={loading}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 text-sm"
              >
                Test (Altered Payload - Idempotency Conflict)
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-purple-600">3. Validar Token & Reanudación</h2>
            <button 
              onClick={handleOpenDiscovery} 
              disabled={!discoveryUrl}
              className="w-full bg-purple-600 text-white px-4 py-3 rounded hover:bg-purple-700 disabled:opacity-50 font-bold"
            >
              Abrir Discovery de prueba
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Abre el URL, verifica que exchangeDiscoveryToken funcione (token consumido), y vuelve a ejecutar "Test (Same Payload)" arriba para validar reanudación (NUEVO access token, 0 links adicionales).
            </p>
          </div>
        </div>

        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-[600px] overflow-y-auto shadow-inner">
          <h3 className="text-gray-400 mb-2 border-b border-gray-700 pb-2">Console Output</h3>
          {log.length === 0 && <span className="text-gray-600">Waiting for actions...</span>}
          {log.map((entry, idx) => (
            <div key={idx} className="mb-1">{entry}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
