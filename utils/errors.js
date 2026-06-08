function setupProcessErrorHandlers({ logger }) {
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', { reason: String(reason) });
  });

  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', { message: err?.message, stack: err?.stack });
  });
}

module.exports = { setupProcessErrorHandlers };

