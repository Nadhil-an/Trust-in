describe('Accountant Forms Automation', () => {
  beforeEach(() => {
    cy.login('ACCOUNTANT')
  })

  it('successfully records new income', () => {
    cy.visit('/slt/finance/income')

    cy.contains('button', '+ Add Income').click()
    cy.get('.modal-content', { timeout: 10000 }).should('be.visible')

    // Fill form
    cy.get('input[name="amount"]').type('15000')
    cy.get('input[name="donor_name"]').type('Acme Corp')
    cy.get('input[name="phone"]').type('8888888888')

    cy.intercept('POST', '**/api/**/income*').as('saveIncome')
    cy.contains('button', 'Save').click()

    cy.wait('@saveIncome').its('response.statusCode').should('be.oneOf', [200, 201])
    cy.contains('Income recorded').should('be.visible')
  })
})
