describe('HR Forms Automation', () => {
  beforeEach(() => {
    cy.login('HR')
  })

  it('successfully creates a new member', () => {
    cy.visit('/slt/hr/members')

    cy.contains('button', '+ Add Member').click()
    cy.get('.modal', { timeout: 10000 }).should('be.visible')

    // Fill form
    cy.get('label:contains("Full Name")').siblings('input').type('John Doe')
    cy.get('label:contains("Phone")').siblings('input').type('1234567890')
    cy.get('label:contains("Monthly Fee (₹)")').siblings('input').type('500')

    cy.intercept('POST', '**/api/**/members*', { statusCode: 201, body: { id: 1, message: 'Success' } }).as('saveMember')
    cy.contains('button', 'Save').click()

    cy.wait('@saveMember').its('response.statusCode').should('be.oneOf', [200, 201])
    cy.contains('Saved.').should('be.visible')
  })
})
