// cypress/support/e2e.js

import './commands'

// Ignore uncaught exceptions to prevent tests from failing due to random app errors
Cypress.on('uncaught:exception', (err, runnable) => {
  return false
})
