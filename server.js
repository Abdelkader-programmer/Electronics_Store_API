require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

const PORT = process.env.PORT || 3000;

// ================= Middleware =================
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ================= Load Electronics Data =================
const electronicsData = {};

try {
    // قراءة جميع ملفات JSON الخاصة بالمنتجات الإلكترونية
    const files = fs
        .readdirSync(__dirname)
        .filter(file => file.endsWith('.json') && !file.includes('package'));

    files.forEach(file => {
        const categoryName = path
            .basename(file, '.json')
            .trim()
            .toLowerCase();

        const fileContent = fs.readFileSync(
            path.join(__dirname, file),
            'utf8'
        );

        electronicsData[categoryName] = JSON.parse(fileContent);
        console.log(`✅ ${categoryName} data loaded successfully`);
    });

    console.log(`🎉 Total categories loaded: ${Object.keys(electronicsData).length}`);
} catch (error) {
    console.error('❌ Failed to load product data:', error.message);
    process.exit(1);
}

// ================= Routes =================

// Welcome page
app.get('/', (req, res) => {
    res.send(`
        <h1>🏪 El-Shehawy Electronics Store API</h1>
        <p>API is ready! Date: Monday, February 23, 2026</p>
        <h3>Available Endpoints:</h3>
        <ul>
            <li><code>GET /api/products/all</code> - All products</li>
            <li><code>GET /api/products/search</code> - Advanced search</li>
            <li><code>GET /api/products/category/:category</code> - Products by category</li>
            <li><code>GET /api/products/:id</code> - Product details</li>
            <li><code>GET /api/categories</code> - List categories</li>
            <li><code>GET /api/products/featured</code> - Featured products</li>
            <li><code>GET /api/products/random</code> - Random products</li>
            <li><code>GET /api/products/similar/:id</code> - Similar products</li>
            <li><code>GET /api/products/stats</code> - Statistics</li>
            <li><code>GET /api/products/filter</code> - Filter products</li>
            <li><code>GET /api/products/sort</code> - Sort products</li>
        </ul>
    `);
});

// ---------- GET ALL PRODUCTS ----------
app.get('/api/products/all', (req, res) => {
    const allProducts = Object.values(electronicsData).flat();

    if (req.query.pagination === 'false') {
        return res.status(200).json({
            success: true,
            info: { 
                totalProducts: allProducts.length,
                timestamp: new Date().toISOString()
            },
            results: allProducts
        });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const results = allProducts.slice(startIndex, endIndex);

    res.status(200).json({
        success: true,
        info: {
            totalProducts: allProducts.length,
            totalPages: Math.ceil(allProducts.length / limit),
            currentPage: page,
            productsOnPage: results.length,
            timestamp: new Date().toISOString()
        },
        results
    });
});

// ---------- ADVANCED SEARCH ----------
app.get('/api/products/search', (req, res) => {
    const { 
        q, // General search
        category, 
        color, 
        minPrice, 
        maxPrice, 
        minYear,
        maxYear,
        page = 1, 
        limit = 20 
    } = req.query;
    
    let results = Object.values(electronicsData).flat();

    // General text search
    if (q) {
        const searchTerm = q.toLowerCase();
        results = results.filter(product =>
            product.title?.toLowerCase().includes(searchTerm) ||
            product.description?.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by category
    if (category) {
        results = results.filter(product =>
            product.category?.toLowerCase() === category.toLowerCase()
        );
    }

    // Filter by color
    if (color) {
        results = results.filter(product =>
            product.color?.toLowerCase().includes(color.toLowerCase())
        );
    }

    // Filter by price
    if (minPrice) {
        results = results.filter(product =>
            product.price >= parseFloat(minPrice)
        );
    }
    
    if (maxPrice) {
        results = results.filter(product =>
            product.price <= parseFloat(maxPrice)
        );
    }

    // Filter by model year
    if (minYear) {
        results = results.filter(product =>
            product.model >= parseInt(minYear)
        );
    }
    
    if (maxYear) {
        results = results.filter(product =>
            product.model <= parseInt(maxYear)
        );
    }

    // Sort by price (lowest first)
    results.sort((a, b) => a.price - b.price);

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedResults = results.slice(startIndex, endIndex);

    res.status(200).json({
        success: true,
        info: {
            totalProductsFound: results.length,
            totalPages: Math.ceil(results.length / limit),
            currentPage: parseInt(page),
            productsOnPage: paginatedResults.length,
            filtersApplied: Object.keys(req.query).length
        },
        results: paginatedResults
    });
});

// ---------- GET FEATURED PRODUCTS ----------
app.get('/api/products/featured', (req, res) => {
    const allProducts = Object.values(electronicsData).flat();
    
    // Latest models (2026)
    const latestModels = [...allProducts]
        .filter(p => p.model === 2026)
        .slice(0, 10);
    
    // Most expensive products
    const premiumProducts = [...allProducts]
        .sort((a, b) => b.price - a.price)
        .slice(0, 10);
    
    // Recently added (based on createdAt)
    const newArrivals = [...allProducts]
        .filter(p => p.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

    res.status(200).json({
        success: true,
        featured: {
            latestModels,
            premiumProducts,
            newArrivals
        }
    });
});

// ---------- GET RANDOM PRODUCTS ----------
app.get('/api/products/random', (req, res) => {
    const count = parseInt(req.query.count) || 5;
    const allProducts = Object.values(electronicsData).flat();
    
    // Shuffle array and get random products
    const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
    const randomProducts = shuffled.slice(0, count);

    res.status(200).json({
        success: true,
        info: {
            totalProducts: allProducts.length,
            randomCount: randomProducts.length
        },
        results: randomProducts
    });
});

// ---------- GET PRODUCTS STATISTICS ----------
app.get('/api/products/stats', (req, res) => {
    const allProducts = Object.values(electronicsData).flat();
    
    // Price statistics
    const prices = allProducts.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Model year statistics
    const models = allProducts.map(p => p.model);
    const uniqueModels = [...new Set(models)];
    
    // Color statistics
    const colors = allProducts.map(p => p.color?.toLowerCase()).filter(Boolean);
    const colorCount = {};
    colors.forEach(color => {
        colorCount[color] = (colorCount[color] || 0) + 1;
    });
    
    // Category statistics
    const categoryStats = Object.entries(electronicsData).map(([category, products]) => ({
        category,
        count: products.length,
        avgPrice: products.reduce((sum, p) => sum + p.price, 0) / products.length
    }));

    res.status(200).json({
        success: true,
        stats: {
            totalProducts: allProducts.length,
            totalCategories: Object.keys(electronicsData).length,
            priceRange: {
                min: minPrice,
                max: maxPrice,
                average: parseFloat(avgPrice.toFixed(2))
            },
            modelYears: {
                available: uniqueModels.sort((a, b) => b - a),
                latest: Math.max(...uniqueModels),
                oldest: Math.min(...uniqueModels)
            },
            topColors: Object.entries(colorCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([color, count]) => ({ color, count })),
            categoryBreakdown: categoryStats
        }
    });
});

// ---------- FILTER PRODUCTS WITH MULTIPLE OPTIONS ----------
app.get('/api/products/filter', (req, res) => {
    const {
        category,
        minPrice,
        maxPrice,
        color,
        model,
        sortBy = 'price',
        sortOrder = 'asc',
        page = 1,
        limit = 20
    } = req.query;

    let results = Object.values(electronicsData).flat();

    // Filter by category
    if (category) {
        const categories = category.split(',').map(c => c.trim().toLowerCase());
        results = results.filter(product => 
            product.category && categories.includes(product.category.toLowerCase())
        );
    }

    // Filter by price range
    if (minPrice) {
        results = results.filter(product => product.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
        results = results.filter(product => product.price <= parseFloat(maxPrice));
    }

    // Filter by color
    if (color) {
        const colors = color.split(',').map(c => c.trim().toLowerCase());
        results = results.filter(product => 
            product.color && colors.some(c => product.color.toLowerCase().includes(c))
        );
    }

    // Filter by model year
    if (model) {
        const models = model.split(',').map(m => parseInt(m.trim()));
        results = results.filter(product => models.includes(product.model));
    }

    // Sort results
    if (sortBy === 'price') {
        results.sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
    } else if (sortBy === 'model') {
        results.sort((a, b) => sortOrder === 'asc' ? a.model - b.model : b.model - a.model);
    } else if (sortBy === 'title') {
        results.sort((a, b) => 
            sortOrder === 'asc' 
                ? a.title.localeCompare(b.title)
                : b.title.localeCompare(a.title)
        );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedResults = results.slice(startIndex, endIndex);

    res.status(200).json({
        success: true,
        filters: {
            category: category || 'all',
            priceRange: `${minPrice || 'min'} - ${maxPrice || 'max'}`,
            color: color || 'all',
            model: model || 'all',
            sortBy,
            sortOrder
        },
        info: {
            totalFound: results.length,
            totalPages: Math.ceil(results.length / limit),
            currentPage: parseInt(page),
            productsOnPage: paginatedResults.length
        },
        results: paginatedResults
    });
});

// ---------- SORT PRODUCTS ----------
app.get('/api/products/sort', (req, res) => {
    const { 
        by = 'price', // price, model, title
        order = 'asc', // asc, desc
        category,
        page = 1,
        limit = 20
    } = req.query;

    let results = Object.values(electronicsData).flat();

    // Filter by category if specified
    if (category) {
        results = results.filter(product => 
            product.category?.toLowerCase() === category.toLowerCase()
        );
    }

    // Sort results
    if (by === 'price') {
        results.sort((a, b) => order === 'asc' ? a.price - b.price : b.price - a.price);
    } else if (by === 'model') {
        results.sort((a, b) => order === 'asc' ? a.model - b.model : b.model - a.model);
    } else if (by === 'title') {
        results.sort((a, b) => 
            order === 'asc' 
                ? a.title.localeCompare(b.title)
                : b.title.localeCompare(a.title)
        );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedResults = results.slice(startIndex, endIndex);

    res.status(200).json({
        success: true,
        sort: {
            by,
            order,
            category: category || 'all'
        },
        info: {
            totalProducts: results.length,
            totalPages: Math.ceil(results.length / limit),
            currentPage: parseInt(page),
            productsOnPage: paginatedResults.length
        },
        results: paginatedResults
    });
});

// ---------- GET PRODUCTS BY PRICE RANGE ----------
app.get('/api/products/price-range/:range', (req, res) => {
    const range = req.params.range;
    const allProducts = Object.values(electronicsData).flat();
    
    let filteredProducts = [];
    let rangeLabel = '';

    switch(range) {
        case 'budget':
            filteredProducts = allProducts.filter(p => p.price <= 2000);
            rangeLabel = 'Budget (≤ 2000 EGP)';
            break;
        case 'mid':
            filteredProducts = allProducts.filter(p => p.price > 2000 && p.price <= 5000);
            rangeLabel = 'Mid-range (2000-5000 EGP)';
            break;
        case 'premium':
            filteredProducts = allProducts.filter(p => p.price > 5000 && p.price <= 10000);
            rangeLabel = 'Premium (5000-10000 EGP)';
            break;
        case 'luxury':
            filteredProducts = allProducts.filter(p => p.price > 10000);
            rangeLabel = 'Luxury (> 10000 EGP)';
            break;
        default:
            return res.status(400).json({
                success: false,
                message: 'Invalid price range. Use: budget, mid, premium, luxury'
            });
    }

    res.status(200).json({
        success: true,
        priceRange: rangeLabel,
        info: {
            totalProducts: filteredProducts.length,
            minPrice: Math.min(...filteredProducts.map(p => p.price)),
            maxPrice: Math.max(...filteredProducts.map(p => p.price)),
            avgPrice: parseFloat((filteredProducts.reduce((sum, p) => sum + p.price, 0) / filteredProducts.length).toFixed(2))
        },
        results: filteredProducts
    });
});

// ---------- GET PRODUCTS BY COLOR ----------
app.get('/api/products/color/:color', (req, res) => {
    const color = req.params.color.toLowerCase();
    const allProducts = Object.values(electronicsData).flat();
    
    const filteredProducts = allProducts.filter(product => 
        product.color?.toLowerCase().includes(color)
    );

    res.status(200).json({
        success: true,
        color: req.params.color,
        info: {
            totalProducts: filteredProducts.length,
            availableColors: [...new Set(filteredProducts.map(p => p.color).filter(Boolean))]
        },
        results: filteredProducts
    });
});

// ---------- GET SIMILAR PRODUCTS ----------
app.get('/api/products/similar/:id', (req, res) => {
    const id = req.params.id;
    let foundProduct = null;
    let foundCategory = null;

    // Find the product
    for (const [category, products] of Object.entries(electronicsData)) {
        const product = products.find(p => String(p.id) === String(id));
        if (product) {
            foundProduct = product;
            foundCategory = category;
            break;
        }
    }

    if (!foundProduct) {
        return res.status(404).json({ 
            success: false,
            message: `Product with ID [${id}] not found.`
        });
    }

    // Get products from same category (excluding the current product)
    const similarProducts = electronicsData[foundCategory]
        .filter(p => String(p.id) !== String(id))
        .slice(0, 5);

    res.status(200).json({
        success: true,
        currentProduct: foundProduct.title,
        category: foundCategory,
        similarCount: similarProducts.length,
        results: similarProducts
    });
});

// ---------- GET PRODUCTS BY CATEGORY ----------
app.get('/api/products/category/:category', (req, res) => {
    const category = req.params.category.toLowerCase().trim();
    const categoryData = electronicsData[category];

    if (!categoryData) {
        return res.status(404).json({ 
            success: false,
            message: `Category '${req.params.category}' not found.`
        });
    }

    res.status(200).json({
        success: true,
        info: { 
            totalProducts: categoryData.length,
            category: req.params.category
        },
        results: categoryData
    });
});

// ---------- GET PRODUCT DETAILS ----------
app.get('/api/products/:id', (req, res) => {
    const id = req.params.id;
    let foundProduct = null;
    let foundCategory = null;

    // Search for product in all categories
    for (const [category, products] of Object.entries(electronicsData)) {
        const product = products.find(p => String(p.id) === String(id));
        if (product) {
            foundProduct = { ...product }; // Create a copy
            foundCategory = category;
            break;
        }
    }

    if (!foundProduct) {
        return res.status(404).json({ 
            success: false,
            message: `Product with ID [${id}] not found.`
        });
    }

    // Add category to product object
    foundProduct.category = foundCategory;

    res.status(200).json({
        success: true,
        message: 'Product details fetched successfully',
        product: foundProduct
    });
});

// ---------- ADD NEW PRODUCT ----------
app.post('/api/products', (req, res) => {
    const { 
        title, 
        model, 
        price, 
        color,
        category
    } = req.body;

    // Check required fields
    const requiredFields = ['title', 'model', 'price', 'color', 'category'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingFields.join(', ')}`
        });
    }

    const categoryKey = category.toLowerCase().trim();
    const newProduct = {
        id: Date.now(), // Temporary unique ID
        title,
        model: parseInt(model),
        price: parseFloat(price),
        color,
        category,
        createdAt: new Date().toISOString(),
        ...req.body
    };

    // If category doesn't exist, create it
    if (!electronicsData[categoryKey]) {
        electronicsData[categoryKey] = [];
    }

    electronicsData[categoryKey].push(newProduct);

    res.status(201).json({
        success: true,
        message: 'Product added successfully (in-memory only)',
        product: newProduct,
        info: {
            totalInCategory: electronicsData[categoryKey].length
        }
    });
});

// ---------- GET CATEGORIES LIST ----------
app.get('/api/categories', (req, res) => {
    const categories = Object.keys(electronicsData).map(category => ({
        name: category,
        count: electronicsData[category].length,
        sampleProduct: electronicsData[category][0]?.title || 'No products'
    }));

    res.status(200).json({
        success: true,
        info: {
            totalCategories: categories.length,
            timestamp: new Date().toISOString()
        },
        categories
    });
});

// ================= Error Handling =================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.originalUrl}`
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ================= Start Server =================
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📅 Date: Monday, February 23, 2026`);
    console.log(`🕐 Time: 01:28 AM (Cairo Time)`);
    console.log(`📦 Total categories loaded: ${Object.keys(electronicsData).length}`);
    console.log(`🎯 Try these endpoints:`);
    console.log(`   • http://localhost:${PORT}/api/products/all`);
    console.log(`   • http://localhost:${PORT}/api/products/random`);
    console.log(`   • http://localhost:${PORT}/api/products/stats`);
    console.log(`   • http://localhost:${PORT}/api/categories`);
});