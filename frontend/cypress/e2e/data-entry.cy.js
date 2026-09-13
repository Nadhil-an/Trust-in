describe('Data Entry Forms Automation', () => {
  beforeEach(() => {
    // Assuming login works and sets the correct role/token
    // In a real scenario, you'd want to seed the database or intercept the API
    cy.login('DATA_ENTRY')
  })

  it('successfully fills and saves a Donation Entry', () => {
    cy.visit('/slt/entry/donation')

    // Click the button to open the modal
    cy.contains('button', '+ Record Donation').click()

    // Ensure the modal is visible
    cy.get('.modal', { timeout: 10000 }).should('be.visible')

    // Fill the form
    cy.get('input[name="source"]').type('Direct Donation')
    cy.get('#donor_name_input').type('Test Donor ' + Date.now())
    cy.get('#place_input').type('Kerala')
    cy.get('#phone_input').type('9876543210')
    cy.get('#amount_input').type('5000')

    // Select payment method (Assuming it's a select or similar custom component)
    // For now we assume CASH is default

    // Intercept the API request to verify it's sending the correct data
    // Assuming the API is /api/accounts/income or similar based on accountsApi.income.create
    cy.intercept('POST', '**/api/**/income*').as('saveDonation')

    // Submit the form
    cy.contains('button', 'Save Donation').click()

    // Wait for the API request to finish and verify it was successful
    cy.wait('@saveDonation').its('response.statusCode').should('be.oneOf', [200, 201])

    // Verify success toast/message is shown
    cy.get('.go3958317564').should('exist') // This is a react-hot-toast generic class, or we can check for text
    cy.contains('Donation recorded').should('be.visible')
  })
})
