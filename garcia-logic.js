// ============================================================
// garcia-logic.js — Change Enablement Agent
// Implements SKILL.md Sections 1, 2, and 4
// ============================================================

// --- DOM References ---
var changeForm = document.getElementById('change-form');
var resultsSection = document.getElementById('results');
var classificationBadge = document.getElementById('classification-badge');
var classificationDesc = document.getElementById('classification-desc');
var riskSection = document.getElementById('risk-section');
var approvalSection = document.getElementById('approval-section');
var approvalSteps = document.getElementById('approval-steps');
var checklistSection = document.getElementById('checklist-section');
var compositeScoreEl = document.getElementById('composite-score');
var riskTierEl = document.getElementById('risk-tier');
var recalcBtn = document.getElementById('recalc-btn');
var sliders = document.querySelectorAll('.risk-slider');

// Track the current classification so the recalc button knows context
var currentClassification = null;


// ============================================================
// 1. classifyChange()  —  SKILL.md Section 1.3 Decision Tree
// ============================================================
//
// Decision tree (verbatim from SKILL.md):
//
//   Is service currently down or critically degraded?
//   ├── YES → Is this change the fix? → YES → EMERGENCY
//   │                                  → NO  → Raise incident first, then NORMAL
//   ├── NO  → Is this a pre-approved change model?
//   │         ├── YES → STANDARD
//   │         └── NO  → NORMAL (assess risk tier below)
//
// Parameters:
//   serviceDown  (boolean) — Is the service currently down?
//   preApproved  (boolean) — Is this a pre-approved change model?
//
// Returns: "Standard" | "Normal" | "Emergency"
// ============================================================
function classifyChange(serviceDown, preApproved) {
  if (serviceDown) {
    // Service is down — this is the fix → Emergency
    // (The form assumes the user is submitting a fix for the outage)
    return 'Emergency';
  }
  if (preApproved) {
    // Not down + pre-approved change model → Standard
    return 'Standard';
  }
  // Not down + not pre-approved → Normal (risk assessment needed)
  return 'Normal';
}


// ============================================================
// 2. assessRisk()  —  SKILL.md Section 2.1 & 2.2
// ============================================================
//
// Section 2.1 — Seven risk dimensions, each scored 1–5:
//   Impact scope, Complexity, Reversibility, Testing confidence,
//   Deployment history, Timing sensitivity, Dependency count
//
// Section 2.2 — Composite score & tier:
//   risk_score = sum(all_dimensions) / number_of_dimensions
//
//   | Composite Score | Risk Tier | Approval Path    |
//   |-----------------|-----------|------------------|
//   | 1.0 – 2.0      | Low       | Peer review      |
//   | 2.1 – 3.5      | Medium    | Change authority  |
//   | 3.6 – 5.0      | High      | Full CAB          |
//
// Parameters:
//   scores (array of 7 numbers, each 1–5)
//
// Returns: { compositeScore: number, riskTier: string }
// ============================================================
function assessRisk(scores) {
  var sum = 0;
  for (var i = 0; i < scores.length; i++) {
    sum += scores[i];
  }
  var compositeScore = sum / scores.length;

  var riskTier;
  if (compositeScore <= 2.0) {
    riskTier = 'Low';
  } else if (compositeScore <= 3.5) {
    riskTier = 'Medium';
  } else {
    riskTier = 'High';
  }

  return {
    compositeScore: compositeScore,
    riskTier: riskTier
  };
}


// ============================================================
// 3. getApprovalPath()  —  SKILL.md Section 4
// ============================================================
//
// Section 4.1 — Standard Change Flow
// Section 4.2 — Normal Change Flow (Low Risk)
// Section 4.3 — Normal Change Flow (Medium Risk)
// Section 4.4 — Normal Change Flow (High Risk)
// Section 4.5 — Emergency Change Flow
//
// Parameters:
//   classification (string) — "Standard" | "Normal" | "Emergency"
//   riskTier       (string) — "Low" | "Medium" | "High" (only used for Normal)
//
// Returns: array of step strings
// ============================================================
function getApprovalPath(classification, riskTier) {

  // Section 4.1 — Standard Change Flow
  if (classification === 'Standard') {
    return [
      'Requester triggers pipeline',
      'Automated pre-checks (lint, test, scan)',
      'Auto-approved (change model match verified)',
      'Deploy',
      'Automated validation',
      'Change record logged automatically'
    ];
  }

  // Section 4.5 — Emergency Change Flow
  if (classification === 'Emergency') {
    return [
      'Incident declared',
      'Emergency RFC created (minimal fields)',
      'ECAB approval (phone/chat, 2 approvers minimum)',
      'Implement immediately',
      'Validate service restored',
      'Retrospective RFC completion (within 48h)',
      'Mandatory PIR'
    ];
  }

  // Normal — approval path varies by risk tier (Sections 4.2–4.4)

  // Section 4.2 — Normal Change Flow (Low Risk)
  if (riskTier === 'Low') {
    return [
      'Requester submits RFC',
      'Automated risk scoring',
      'Peer review (1 reviewer, async)',
      'Approved \u2192 Scheduled in change calendar',
      'Deploy in approved window',
      'Validation',
      'Close RFC'
    ];
  }

  // Section 4.3 — Normal Change Flow (Medium Risk)
  if (riskTier === 'Medium') {
    return [
      'Requester submits RFC',
      'Automated risk scoring',
      'Technical review (architect or senior engineer)',
      'Change authority approval',
      'Scheduled in change calendar (with conflict check)',
      'Deploy with monitoring',
      'Validation + brief PIR',
      'Close RFC'
    ];
  }

  // Section 4.4 — Normal Change Flow (High Risk)
  return [
    'Requester submits RFC',
    'Automated risk scoring',
    'Technical review + security review',
    'Pre-CAB: documentation completeness check',
    'CAB review (weekly cadence or ad-hoc)',
    'Senior management sign-off',
    'Scheduled with communication plan',
    'Deploy with war-room / bridge call',
    'Validation + full PIR',
    'Close RFC'
  ];
}


// ============================================================
// Helper — Classification descriptions (from Section 1)
// ============================================================
function getClassificationDesc(classification) {
  if (classification === 'Standard') {
    return 'Pre-authorized, low-risk, well-understood, repeatable change. '
      + 'No approval required at request time. Lead time: minutes to hours.';
  }
  if (classification === 'Emergency') {
    return 'Must be implemented immediately to restore service or prevent '
      + 'imminent critical impact. Expedited ECAB approval required. '
      + 'Full documentation due within 48 hours.';
  }
  return 'Requires assessment, authorization, and scheduling. '
    + 'Adjust the risk sliders below and click "Assess Risk" to determine '
    + 'the approval path. Lead time: 1\u20135 business days depending on risk tier.';
}


// ============================================================
// Helper — Render an ordered list of approval steps
// ============================================================
function renderApprovalSteps(steps) {
  approvalSteps.innerHTML = '';
  for (var i = 0; i < steps.length; i++) {
    var li = document.createElement('li');
    li.textContent = steps[i];
    approvalSteps.appendChild(li);
  }
}


// ============================================================
// Helper — Read slider values and run assessRisk + display
// ============================================================
function runRiskAssessment() {
  var scores = [];
  sliders.forEach(function (slider) {
    scores.push(parseInt(slider.value, 10));
  });

  var result = assessRisk(scores);

  // Display composite score
  compositeScoreEl.textContent = result.compositeScore.toFixed(1);

  // Display risk tier badge
  riskTierEl.textContent = result.riskTier;
  riskTierEl.className = 'risk-tier-badge ' + result.riskTier.toLowerCase();

  // Display approval path for this Normal change at the assessed risk tier
  var steps = getApprovalPath('Normal', result.riskTier);
  renderApprovalSteps(steps);
  approvalSection.classList.remove('hidden');

  // Show the mitigation checklist (Section 2.3)
  checklistSection.classList.remove('hidden');
}


// ============================================================
// 4. Event Handlers — Wire functions to the HTML form
// ============================================================

// --- Form submission: classify the change and show results ---
changeForm.addEventListener('submit', function (e) {
  e.preventDefault();

  var serviceDownEl = document.querySelector('input[name="service-down"]:checked');
  var preApprovedEl = document.querySelector('input[name="pre-approved"]:checked');

  if (!serviceDownEl || !preApprovedEl) return;

  var serviceDown = serviceDownEl.value === 'yes';
  var preApproved = preApprovedEl.value === 'yes';

  // Step 1: Classify using Section 1.3 decision tree
  currentClassification = classifyChange(serviceDown, preApproved);

  // Step 2: Show classification badge and description
  classificationBadge.textContent = currentClassification;
  classificationBadge.className = 'classification-badge ' + currentClassification.toLowerCase();
  classificationDesc.textContent = getClassificationDesc(currentClassification);

  // Step 3: Branch on classification type
  if (currentClassification === 'Normal') {
    // Show risk sliders so user can score dimensions, hide approval/checklist until assessed
    riskSection.classList.remove('hidden');
    approvalSection.classList.add('hidden');
    checklistSection.classList.add('hidden');

  } else {
    // Standard or Emergency — no risk sliders needed
    riskSection.classList.add('hidden');

    // Show approval path directly (Section 4.1 or 4.5)
    var steps = getApprovalPath(currentClassification, null);
    renderApprovalSteps(steps);
    approvalSection.classList.remove('hidden');

    // Show mitigation checklist for Emergency (Section 2.3)
    // Standard changes are pre-approved so checklist is optional
    if (currentClassification === 'Emergency') {
      checklistSection.classList.remove('hidden');
    } else {
      checklistSection.classList.add('hidden');
    }
  }

  // Reset checkboxes
  var checkboxes = document.querySelectorAll('#mitigation-checklist input[type="checkbox"]');
  checkboxes.forEach(function (cb) {
    cb.checked = false;
  });

  // Show results section and scroll to it
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
});


// --- Slider live-update: show current value as user drags ---
sliders.forEach(function (slider) {
  slider.addEventListener('input', function () {
    this.nextElementSibling.textContent = this.value;
  });
});


// --- Recalculate / Assess Risk button ---
recalcBtn.addEventListener('click', function () {
  runRiskAssessment();
});
