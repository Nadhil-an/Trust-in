import axios from 'axios';

async function fix() {
  try {
    // login to get token
    const loginRes = await axios.post('http://localhost:8000/api/auth/login/', 
      { username: 'shanavas', password: '123' }, 
      { headers: { 'Content-Type': 'application/json' } }
    );
    // Note: Django simple jwt might return access instead of access_token
    const token = loginRes.data.access || loginRes.data.access_token;

    const dsRes = await axios.get('http://localhost:8000/api/accounts/day-sheet/?date=2026-09-24', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = dsRes.data;

    let debits = data.debit_rows || [];
    let credits = data.credit_rows || [];

    // Filter out the income records from credits
    // "PARTNER", "DIAP", "man"
    const incomesToMove = credits.filter(c => 
      c.particular === 'PARTNER' || c.particular === 'DIAP' || c.particular === 'man' || c.particular === 'MEN'
    );
    
    // Keep only non-income records in credits
    credits = credits.filter(c => 
      !(c.particular === 'PARTNER' || c.particular === 'DIAP' || c.particular === 'man' || c.particular === 'MEN')
    );

    // Append to debits
    for (const inc of incomesToMove) {
        // find first empty in debits starting from index 8
        let emptyIdx = -1;
        for (let i = 8; i < debits.length; i++) {
            if (!debits[i].particular && !debits[i].amount) {
                emptyIdx = i;
                break;
            }
        }
        if (emptyIdx !== -1) {
            debits[emptyIdx] = inc;
        } else {
            debits.push(inc);
        }
    }

    // Save
    await axios.post('http://localhost:8000/api/cashier/cash-closing/', {
        date: '2026-09-24',
        physical_cash: data.physical_cash || 0,
        physical_bank: data.physical_bank || 0,
        debit_rows: debits,
        credit_rows: credits
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });

    console.log("Fixed!");
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}

fix();
