describe('Manager Forms Automation', () => {
  beforeEach(() => {
    cy.login('MANAGER')
  })

  it('successfully creates a new partner', () => {
    cy.visit('/slt/mgr/partners')

    cy.contains('button', '+ Add Partner').click()
    cy.get('.modal', { timeout: 10000 }).should('be.visible')

    // Fill form
    cy.get('label:contains("Organization Name")').siblings('input').type('Rotary Club')
    cy.get('label:contains("Contact Person")').siblings('input').type('Jane Smith')
    cy.get('label:contains("Phone")').siblings('input').type('9876543210')

    cy.intercept('POST', '**/api/**/partners*', { statusCode: 201, body: { id: 1, message: 'Success' } }).as('savePartner')
    cy.contains('button', 'Save').click()

    cy.wait('@savePartner').its('response.statusCode').should('be.oneOf', [200, 201])
    cy.contains('Saved.').should('be.visible')
  })
})
