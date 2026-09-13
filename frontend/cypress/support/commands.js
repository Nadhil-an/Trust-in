// cypress/support/commands.js

Cypress.Commands.add('login', (role = 'ADMIN') => {
  cy.visit('/slt/portal/auth')
  // We assume the login page has email/password fields or a way to select a role in dev
  // If the backend has a test user seeder, we use that. 
  // Here we use a generic approach that you might need to adapt to your actual auth mechanism.
  cy.get('input[type="text"], input[type="email"], input[name="username"]').first().type('testuser@example.com')
  cy.get('input[type="password"]').first().type('password')
  cy.get('button[type="submit"]').click()
  
  // Wait for redirect to happen
  cy.url().should('not.include', '/slt/portal/auth')
})

Cypress.Commands.add('fillFormAndSubmit', (fields, submitButtonSelector = 'button[type="submit"]') => {
  Object.entries(fields).forEach(([selector, value]) => {
    if (typeof value === 'object' && value.type === 'select') {
      cy.get(selector).select(value.value)
    } else {
      cy.get(selector).clear().type(value)
    }
  })
  cy.get(submitButtonSelector).first().click()
})
