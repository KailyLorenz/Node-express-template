import express from 'express';
import morgan from 'morgan';
import serveStatic from 'serve-static';
import shopify from './shopify.js';
import webhooks from './webhooks.js';
import prisma from './prisma/index.js';

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

const STATIC_PATH =
	process.env.NODE_ENV === 'production'
		? `${process.cwd()}/frontend/dist`
		: `${process.cwd()}/frontend/`;

const app = express();
// app.set('trust proxy', true)
// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
	shopify.config.auth.callbackPath,
	shopify.auth.callback(),
	shopify.redirectToShopifyOrAppRoot()
);
app.post(
	shopify.config.webhooks.path,
	// @ts-ignore
	shopify.processWebhooks({ webhookHandlers: webhooks })
);

//-------------------------------
// For development
app.use(morgan('dev'));
//-------------------------------

app.use(express.json());
app.use(serveStatic(STATIC_PATH, { index: false }));
// All endpoints after this point will require an active session
app.use('/api/*', shopify.validateAuthenticatedSession());

//---------------------------------
// Routes for extension Checkout
app.get('/wishlist', async (req, res) => {
	const email = req.query.email;

	if (!email) {
		return res.status(400).json({ error: 'Email parameter is required' });
	}

	try {
		const data = await prisma.wishlist.findUnique({
			where: {
				email: email
			},
		});

		if (data) {
			res.status(200).send({data});
		} else {
			res.status(404).send({ error: 'Cart not found' });
		}
	} catch (error) {
		console.error('Error DB', error);
	}
});

app.post('/wishlist', async (req, res) => {
	const { email, data: items } = req.body
	console.log('items', items)

	try {
		// Create a saved cart
		await prisma.wishlist.create({
			data: {
				email, items
			},
		});
		res.status(201).json({data: items  });
	} catch (error) {
		console.error('Error DB:', error);
	}
});

app.delete('/wishlist', async (req, res) => {
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ error: 'Email is required to delete wishlist' });
	}

	try {
		await prisma.wishlist.delete({
			where: {
				email: email,
			},
		});
		res.status(200).json({ message: 'Wishlist successfully deleted' });
	} catch (error) {
		if (error.code === 'P2025') {
			res.status(404).json({ error: 'Wishlist not found' });
		} else {
			console.error('Error deleting wishlist:', error);
		}
	}
});
//-------------------------------

app.listen(PORT, () => {
	console.log('Server listening on port', PORT)
});
