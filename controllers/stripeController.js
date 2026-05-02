const Stripe = require("stripe");

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

function isValidAmount(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  return /^\d+(\.\d{1,2})?$/.test(String(value).trim());
}

exports.getConfig = async (req, res) => {
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    return res.status(503).json({
      error: "Stripe n'est pas configuré côté serveur"
    });
  }

  return res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
};

exports.getTestCards = async (req, res) => {
  return res.json({
    cards: [
      {
        brand: "Visa",
        label: "Paiement réussi",
        number: "4242424242424242",
        expiry: "n'importe quelle date future",
        cvc: "3 chiffres",
        postalCode: "n'importe quel code postal"
      },
      {
        brand: "Visa",
        label: "Carte refusée",
        number: "4000000000000002",
        expiry: "n'importe quelle date future",
        cvc: "3 chiffres",
        postalCode: "n'importe quel code postal"
      },
      {
        brand: "Visa",
        label: "3D Secure requis",
        number: "4000002500003155",
        expiry: "n'importe quelle date future",
        cvc: "3 chiffres",
        postalCode: "n'importe quel code postal"
      }
    ]
  });
};

exports.createPaymentIntent = async (req, res) => {
  const stripe = getStripeClient();

  if (!stripe) {
    return res.status(503).json({
      error: "STRIPE_SECRET_KEY manquante"
    });
  }

  const { amount, currency = "eur", description = "Paiement carte test IRISBANK", metadata } = req.body;

  if (!isValidAmount(amount)) {
    return res.status(400).json({
      error: "Le montant doit être positif avec 2 décimales maximum"
    });
  }

  const amountInCents = Math.round(Number(amount) * 100);

  if (amountInCents < 50) {
    return res.status(400).json({
      error: "Le montant minimum Stripe en EUR est de 0,50€"
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: String(currency).toLowerCase(),
      description,
      automatic_payment_methods: {
        enabled: true
      },
      metadata: {
        userId: String(req.session.user.id),
        ...(metadata && typeof metadata === "object" ? metadata : {})
      }
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status
    });
  } catch (error) {
    console.error("STRIPE PAYMENT INTENT ERROR:", error);

    return res.status(500).json({
      error: error.message || "Erreur Stripe"
    });
  }
};