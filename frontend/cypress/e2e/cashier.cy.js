describe('Cashier Forms Automation', () => {
  beforeEach(() => {
    cy.login('ACCOUNTANT') // Or CASHIER if role exists
  })

  it('successfully records day book', () => {
    cy.visit('/slt/disburse/daily-close')

    cy.contains('button', '+ Record Day Book').click()
    cy.get('.modal', { timeout: 10000 }).should('be.visible')

    // Fill form
    cy.get('label:contains("Physical Cash Count")').siblings('input').type('10000')
    cy.get('label:contains("Total Cash in Bank")').siblings('input').type('25000')
    cy.get('label:contains("Notes")').siblings('textarea').type('End of day auto closing')

    cy.intercept('POST', '**/api/**/closing*', { statusCode: 201, body: { id: 1, message: 'Success' } }).as('saveClosing')
    cy.contains('button', 'Record Day Book').click()

    cy.wait('@saveClosing').its('response.statusCode').should('be.oneOf', [200, 201])
    cy.contains('Day book recorded').should('be.visible')
  })
})
