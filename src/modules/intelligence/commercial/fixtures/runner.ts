import { CommercialDecisionEngine } from '../engine/CommercialDecisionEngine';
import { 
  hotelProfile, 
  restaurantProfile, 
  manufacturaProfile, 
  edgeCaseInsufficientInfo,
  edgeCaseUnknownDecisionMaker,
  edgeCaseExistingErp
} from './profiles';

const profiles = [
  { name: 'Hotel Profile', data: hotelProfile },
  { name: 'Restaurant Profile', data: restaurantProfile },
  { name: 'Manufactura Profile', data: manufacturaProfile },
  { name: 'Edge Case: Insufficient Info', data: edgeCaseInsufficientInfo },
  { name: 'Edge Case: Unknown Decision Maker', data: edgeCaseUnknownDecisionMaker },
  { name: 'Edge Case: Existing ERP', data: edgeCaseExistingErp }
];

console.log('=================================================');
console.log('AURA COMMERCIAL DECISION ENGINE RUNNER');
console.log('=================================================\n');

profiles.forEach(profile => {
  console.log(`\n--- Evaluating: ${profile.name} ---`);
  
  const output = CommercialDecisionEngine.evaluate(profile.data, { currentDate: new Date().toISOString() });
  
  console.log(`Opportunity Score: ${output.opportunityScore.total} / 100 (Confidence: ${output.opportunityScore.confidence}%)`);
  console.log(`Priority: ${output.priority}`);
  console.log(`Closing Probability: ${output.probabilityOfClosing.probability}%`);
  console.log(`Action: ${output.action.code}`);
  console.log(`Timing: ${output.timing}`);
  console.log(`Channel: ${output.channel}`);
  console.log(`Presentation: ${output.recommendedPresentation}`);
  
  if (output.risks.length > 0) {
    console.log(`Risks: ${output.risks.map(r => r.code).join(', ')}`);
  } else {
    console.log('Risks: None');
  }

  if (output.opportunities.length > 0) {
    console.log(`Opportunities: ${output.opportunities.map(o => o.code).join(', ')}`);
  } else {
    console.log('Opportunities: None');
  }

  console.log(`Explanation: ${output.justification}`);
  console.log('-------------------------------------------------');
});
