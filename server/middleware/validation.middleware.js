const { BadRequestError } = require('../utils/customError');

const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const dataToValidate = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
      const parsed = await schema.parseAsync(dataToValidate);
      
      // Mutate requested values to clean validated ones
      if (source === 'query') req.query = parsed;
      else if (source === 'params') req.params = parsed;
      else req.body = parsed;
      
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const formattedErrors = {};
        err.errors.forEach(e => {
          const path = e.path.join('.');
          formattedErrors[path] = e.message;
        });
        return next(new BadRequestError('Validasi input gagal', formattedErrors));
      }
      next(err);
    }
  };
};

module.exports = validate;
