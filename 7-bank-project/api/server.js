const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors')
const crypto = require('crypto');
const pkg = require('./package.json');
const mongoose = require('mongoose');

// Kết nối đến cơ sở dữ liệu MongoDB
mongoose.connect('mongodb+srv://lamhuetrung:Lht080103@sistern.ajxyvai.mongodb.net/sistern?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// Định nghĩa schema cho account
const accountSchema = new mongoose.Schema({
  user: String,
  currency: String,
  description: String,
  balance: Number,
  transactions: [
    {
      id: String,
      date: String,
      object: String,
      amount: Number
    }
  ]
});
// Tạo model từ schema
const Account = mongoose.model('Account', accountSchema);
// App constants
const port = process.env.PORT || 5000;
const apiPrefix = '/api';

// // Store data in-memory, not suited for production use!
// const db = {
//   test: {
//     user: 'test',
//     currency: '$',
//     description: `Test account`,
//     balance: 75,
//     transactions: [
//       { id: '1', date: '2020-10-01', object: 'Pocket money', amount: 50 },
//       { id: '2', date: '2020-10-03', object: 'Book', amount: -10 },
//       { id: '3', date: '2020-10-04', object: 'Sandwich', amount: -5 }
//     ],
//   }
// };

// Create the Express app & setup middlewares
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({ origin: /http:\/\/(127(\.\d){3}|localhost)/}));
app.options('*', cors());

// ***************************************************************************

// Configure routes
const router = express.Router();

// Get server infos
router.get('/', (req, res) => {
  return res.send(`${pkg.description} v${pkg.version}`);
});

// ----------------------------------------------

// Create an account
router.post('/accounts', async (req, res) => {
  try {
    // Check mandatory request parameters
    if (!req.body.user || !req.body.currency) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Check if account already exists
    const existingAccount = await Account.findOne({ user: req.body.user });
    if (existingAccount) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Convert balance to number if needed
    let balance = req.body.balance;
    if (balance && typeof balance !== 'number') {
      balance = parseFloat(balance);
      if (isNaN(balance)) {
        return res.status(400).json({ error: 'Balance must be a number' });
      }
    }

    // Create account
    const newAccount = new Account({
      user: req.body.user,
      currency: req.body.currency,
      description: req.body.description || `${req.body.user}'s budget`,
      balance: balance || 0,
      transactions: [],
    });
    await newAccount.save();

    return res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ----------------------------------------------

// Get all data for the specified account
router.get('/accounts/:user', async (req, res) => {
  try {
    const account = await Account.findOne({ user: req.params.user });

    // Check if account exists
    if (!account) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    return res.json(account);
  } catch (error) {
    console.error('Error retrieving account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------

// Remove specified account
router.delete('/accounts/:user', async (req, res) => {
  try {
    const deletedAccount = await Account.findOneAndDelete({ user: req.params.user });

    // Check if account exists
    if (!deletedAccount) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// ----------------------------------------------

// Add a transaction to a specific account
// Add a transaction to a specific account
router.post('/accounts/:user/transactions', async (req, res) => {
  try {
    // Find the account by user
    const account = await Account.findOne({ user: req.params.user });

    // Check if account exists
    if (!account) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Check mandatory request parameters
    if (!req.body.date || !req.body.object || !req.body.amount) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Convert amount to number if needed
    let amount = req.body.amount;
    if (typeof amount !== 'number') {
      amount = parseFloat(amount);
    }

    // Check that amount is a valid number
    if (isNaN(amount)) {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    // Generates an ID for the transaction
    const id = crypto
      .createHash('md5')
      .update(req.body.date + req.body.object + req.body.amount)
      .digest('hex');

    // Check if the transaction already exists
    const existingTransaction = account.transactions.find(transaction => transaction.id === id);
    if (existingTransaction) {
      return res.status(409).json({ error: 'Transaction already exists' });
    }

    // Create the new transaction
    const transaction = {
      id,
      date: req.body.date,
      object: req.body.object,
      amount,
    };

    // Add the transaction to the account
    account.transactions.push(transaction);

    // Update the account balance
    account.balance += transaction.amount;

    // Save the updated account
    await account.save();

    // Return the new transaction
    return res.status(201).json(transaction);
  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ----------------------------------------------

// Remove specified transaction from account
router.delete('/accounts/:user/transactions/:id', async (req, res) => {
  try {
    // Find the account by user
    const account = await Account.findOne({ user: req.params.user });

    // Check if account exists
    if (!account) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Find the index of the transaction to be deleted
    const transactionIndex = account.transactions.findIndex(transaction => transaction.id === req.params.id);

    // Check if transaction exists
    if (transactionIndex === -1) {
      return res.status(404).json({ error: 'Transaction does not exist' });
    }

    // Remove the transaction from the transactions array
    account.transactions.splice(transactionIndex, 1);

    // Save the updated account
    await account.save();

    // Send a success response
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ***************************************************************************

// Add 'api` prefix to all routes
app.use(apiPrefix, router);

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
