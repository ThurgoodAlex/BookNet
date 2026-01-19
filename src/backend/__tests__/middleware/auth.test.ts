import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { generateToken } from '../../utils/jwt';

describe('authMiddleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  describe('when no authorization header is provided', () => {
    it('should return 401 with "No token provided" message', () => {
      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'No token provided'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('when authorization header has no token after Bearer', () => {
    it('should return 401 with "No token provided" message', () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'No token provided'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('when authorization header has only Bearer without space', () => {
    it('should return 401 with "No token provided" message', () => {
      mockRequest.headers = { authorization: 'Bearer' };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'No token provided'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('when an invalid token is provided', () => {
    it('should return 401 with "Invalid token" message', () => {
      mockRequest.headers = { authorization: 'Bearer invalid_token' };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Invalid token'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('when an expired token is provided', () => {
    it('should return 401 with "Invalid token" message', () => {
      const expiredToken = generateToken(
        { id: 'user123', role: 'user' },
        '-1s' // Already expired
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Invalid token'
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('when a valid token is provided', () => {
    it('should call next() and set req.user with decoded payload', () => {
      const userId = 'user123';
      const userRole = 'user';
      const token = generateToken({ id: userId, role: userRole });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.id).toBe(userId);
      expect(mockRequest.user?.role).toBe(userRole);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle admin role correctly', () => {
      const token = generateToken({ id: 'admin123', role: 'admin' });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user?.role).toBe('admin');
    });
  });

  describe('when token has malformed structure', () => {
    it('should return 401 for token with wrong format', () => {
      mockRequest.headers = { authorization: 'Basic sometoken' };

      authMiddleware(
        mockRequest as AuthRequest,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Invalid token'
      });
    });
  });
});
