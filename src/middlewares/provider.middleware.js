const { Provider } = require('../../models');

/**
 * Middleware para inyectar el objeto Provider en req si el usuario autenticado es un proveedor.
 */
async function injectProvider(req, res, next) {
    if (!req.user || !req.user.userId) {
        return next();
    }

    try {
        const provider = await Provider.findOne({
            where: { user_id: req.user.userId }
        });

        if (provider) {
            req.provider = provider;
        }

        next();
    } catch (error) {
        console.error('Error in injectProvider middleware:', error);
        next();
    }
}

module.exports = { injectProvider };
