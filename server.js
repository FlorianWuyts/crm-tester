const express = require('express');
const app = express();

app.get('/3cx-lookup', (req, res) => {
    // 1. Get raw number from query param (?phone=...)
    const rawPhone = req.query.phone || '';

    // 2. Clean digits
    let digits = rawPhone.replace(/[^0-9]/g, '');

    // 3. Format: convert local leading zero (e.g. 0478...) to Belgium +32
    if (digits.startsWith('0')) {
        digits = '32' + digits.substring(1);
    }
    const formattedPhone = '+' + digits;

    // 4. Build Autotask URL
    const contactUrl = `https://ww4.autotask.net/Autotask/AutotaskExtend/ExecuteCommand.aspx?Code=OpenAccount&Phone=${encodeURIComponent(formattedPhone)}`;

    // 5. Send basic 3CX CRM JSON response
    res.json({
        ContactId: "1",
        FirstName: "Autotask",
        LastName: "Account",
        PhoneBusiness: formattedPhone,
        ContactUrl: contactUrl
    });
});

// Start listening on port 3000
app.listen(3000, () => console.log('3CX Test CRM Server running on http://localhost:3000'));
