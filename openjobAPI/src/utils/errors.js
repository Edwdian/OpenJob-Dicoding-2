class ClientError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ClientError';
  }
}

class NotFoundError extends ClientError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class AuthenticationError extends ClientError {
  constructor(message) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends ClientError {
  constructor(message) {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class ConflictError extends ClientError {
  constructor(message) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class BadRequestError extends ClientError {
  constructor(message) {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

module.exports = {
  ClientError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  BadRequestError,
};
