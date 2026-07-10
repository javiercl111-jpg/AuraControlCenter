import type { CommercialDecisionInput } from '../types';
import { CommercialJourneyState } from '../types';

export const hotelProfile: CommercialDecisionInput = {
  journeyState: CommercialJourneyState.RADIOGRAPHY_READY,
  prospectMetadata: {
    industria: 'Hotel',
    tamaño: '100-250',
    estado: 'Quintana Roo',
    economicPotential: { amount: 50000, currency: 'MXN', period: 'MONTHLY', source: 'Advisor Estimate', confidence: 80 },
    origenDelProspecto: 'Inbound'
  },
  confidenceMatrix: { diagnosticConfidence: 85, discoveryQuality: 90, dataCompleteness: 95 },
  dossier: {
    businessName: 'Ocean View Resort',
    description: 'Boutique hotel with high turnover and manual payroll.',
    digitalMaturity: 30,
    transformationOpportunity: 90,
    implementationReadiness: 70,
    painPoints: [{ description: 'Nómina', intensity: 90 }],
    urgencyLevel: 85
  },
  briefingDraft: { summary: 'High priority', keyFindings: ['Decision maker is the owner.'] },
  advisorContext: { advisorId: '1', advisorName: 'Juan', notes: 'Owner is very interested in reducing errors.' }
};

export const restaurantProfile: CommercialDecisionInput = {
  journeyState: CommercialJourneyState.MEETING_PENDING,
  prospectMetadata: {
    industria: 'Restaurante',
    tamaño: '50-100',
    estado: 'CDMX',
    economicPotential: { amount: 20000, currency: 'MXN', period: 'MONTHLY', source: 'Stated Budget', confidence: 90 },
    origenDelProspecto: 'Referral'
  },
  confidenceMatrix: { diagnosticConfidence: 75, discoveryQuality: 80, dataCompleteness: 85 },
  dossier: {
    businessName: 'La Bella Vita',
    description: 'Chain of 3 Italian restaurants.',
    digitalMaturity: 40,
    transformationOpportunity: 75,
    implementationReadiness: 80,
    painPoints: [{ description: 'Alta rotación de personal (RH)', intensity: 85 }],
    urgencyLevel: 70
  },
  briefingDraft: { summary: 'Growth phase', keyFindings: ['Decision maker: Operations Manager'] },
  advisorContext: { advisorId: '1', advisorName: 'Juan', notes: 'Need better control of shifts.' }
};

export const manufacturaProfile: CommercialDecisionInput = {
  journeyState: CommercialJourneyState.BRIEFING_READY,
  prospectMetadata: {
    industria: 'Manufactura',
    tamaño: '500+',
    estado: 'Nuevo León',
    economicPotential: { amount: 150000, currency: 'MXN', period: 'MONTHLY', source: 'Market Average', confidence: 60 },
    origenDelProspecto: 'Outbound'
  },
  confidenceMatrix: { diagnosticConfidence: 85, discoveryQuality: 85, dataCompleteness: 90 },
  dossier: {
    businessName: 'Aceros del Norte',
    description: 'Large steel manufacturing plant.',
    digitalMaturity: 60,
    transformationOpportunity: 80,
    implementationReadiness: 65,
    painPoints: [{ description: 'Fallas en equipos (Mantenimiento)', intensity: 95 }],
    urgencyLevel: 90
  },
  briefingDraft: { summary: 'Operational bottlenecks', keyFindings: ['Decision maker: Plant Director'] },
  advisorContext: { advisorId: '2', advisorName: 'Ana', notes: 'Very technical team.' }
};

export const edgeCaseInsufficientInfo: CommercialDecisionInput = {
  journeyState: CommercialJourneyState.DISCOVERY_COMPLETED,
  prospectMetadata: {
    industria: 'Tecnología',
    tamaño: 'Unknown',
    estado: 'Jalisco',
    economicPotential: { amount: null, currency: 'MXN', period: 'UNKNOWN', source: 'None', confidence: 0 },
    origenDelProspecto: 'Website'
  },
  confidenceMatrix: { diagnosticConfidence: 30, discoveryQuality: 40, dataCompleteness: 20 },
  advisorContext: { advisorId: '3', advisorName: 'Carlos', notes: 'They did not answer many questions.' }
};

export const edgeCaseUnknownDecisionMaker: CommercialDecisionInput = {
  journeyState: CommercialJourneyState.RADIOGRAPHY_READY,
  prospectMetadata: {
    industria: 'Hospital',
    tamaño: '200+',
    estado: 'Puebla',
    economicPotential: { amount: 80000, currency: 'MXN', period: 'MONTHLY', source: 'Estimate', confidence: 70 },
    origenDelProspecto: 'Event'
  },
  confidenceMatrix: { diagnosticConfidence: 80, discoveryQuality: 85, dataCompleteness: 90 },
  dossier: {
    businessName: 'Hospital San Lucas',
    description: 'Regional hospital.',
    digitalMaturity: 50,
    transformationOpportunity: 80,
    implementationReadiness: 70,
    painPoints: [{ description: 'Nómina compleja', intensity: 80 }],
    urgencyLevel: 75
  },
  briefingDraft: { summary: 'Complex structure', keyFindings: [] }, // Missing decision maker
  advisorContext: { advisorId: '1', advisorName: 'Juan', notes: 'Met with IT lead, unsure who signs.' }
};

export const edgeCaseExistingErp: CommercialDecisionInput = {
  journeyState: CommercialJourneyState.BRIEFING_READY,
  prospectMetadata: {
    industria: 'Logística',
    tamaño: '300',
    estado: 'Edomex',
    economicPotential: { amount: 100000, currency: 'MXN', period: 'MONTHLY', source: 'Budget', confidence: 90 },
    origenDelProspecto: 'Inbound'
  },
  confidenceMatrix: { diagnosticConfidence: 90, discoveryQuality: 90, dataCompleteness: 95 },
  dossier: {
    businessName: 'Logística Express',
    description: 'National logistics.',
    digitalMaturity: 70,
    transformationOpportunity: 85,
    implementationReadiness: 80,
    painPoints: [{ description: 'Procesos manuales de RH', intensity: 85 }],
    urgencyLevel: 80
  },
  conversationSummary: { topicsDiscussed: ['Uso de SAP para contabilidad', 'Falta de integración con RH'], sentiment: 'Positive' },
  briefingDraft: { summary: 'Needs integration', keyFindings: ['Decision maker: CFO'] },
  advisorContext: { advisorId: '2', advisorName: 'Ana', notes: 'They use SAP but HR is manual.' }
};
