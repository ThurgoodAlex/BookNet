import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createTestApp } from '../testApp';
import { createTestUser, authHeader } from '../helpers';
import { User } from '../../models/User';

const app = createTestApp();

describe('Auth Routes', () => {
  describe('POST /auth/register', () => {
    describe('with valid data', () => {
      it('should create a new user and return token', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('User registered successfully');
        expect(response.body.token).toBeDefined();
        expect(response.body.user).toBeDefined();
        expect(response.body.user.username).toBe('newuser');
        expect(response.body.user.email).toBe('newuser@example.com');
        expect(response.body.user.password).toBeUndefined();
      });

      it('should hash the password before saving', async () => {
        await request(app)
          .post('/auth/register')
          .send({
            username: 'hashtest',
            email: 'hashtest@example.com',
            password: 'password123'
          });

        const user = await User.findOne({ email: 'hashtest@example.com' });
        expect(user).toBeDefined();
        expect(user!.password).not.toBe('password123');
        const isMatch = await bcrypt.compare('password123', user!.password);
        expect(isMatch).toBe(true);
      });

      it('should set default role to user', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'roletest',
            email: 'roletest@example.com',
            password: 'password123'
          });

        const user = await User.findOne({ email: 'roletest@example.com' });
        expect(user!.role).toBe('user');
      });
    });

    describe('with invalid data', () => {
      it('should return 400 when username is missing', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });

      it('should return 400 when username is too short', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'ab',
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toContain('3-30 characters');
      });

      it('should return 400 when username is too long', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'a'.repeat(31),
            email: 'test@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });

      it('should return 400 when email is invalid', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'testuser',
            email: 'not-an-email',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toContain('valid email');
      });

      it('should return 400 when email is missing', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'testuser',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });

      it('should return 400 when password is too short', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'testuser',
            email: 'test@example.com',
            password: '12345'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toContain('at least 6 characters');
      });

      it('should return 400 when password is missing', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'testuser',
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('with duplicate data', () => {
      it('should return 409 when email already exists', async () => {
        await createTestUser({ email: 'existing@example.com' });

        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'newuser',
            email: 'existing@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Email already exists');
      });

      it('should return 409 when username already exists', async () => {
        await createTestUser({ username: 'existinguser' });

        const response = await request(app)
          .post('/auth/register')
          .send({
            username: 'existinguser',
            email: 'new@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('Username already taken');
      });
    });
  });

  describe('POST /auth/login', () => {
    describe('with valid credentials', () => {
      it('should return token and user info', async () => {
        const testUser = await createTestUser({
          email: 'login@example.com',
          password: 'password123'
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'login@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Logged in successfully');
        expect(response.body.token).toBeDefined();
        expect(response.body.user).toBeDefined();
        expect(response.body.user.id).toBeDefined();
        expect(response.body.user.username).toBe(testUser.username);
        expect(response.body.user.email).toBe('login@example.com');
        expect(response.body.user.role).toBe('user');
        expect(response.body.user.password).toBeUndefined();
      });
    });

    describe('with invalid credentials', () => {
      it('should return 401 when email does not exist', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid email or password');
      });

      it('should return 401 when password is incorrect', async () => {
        await createTestUser({
          email: 'wrongpass@example.com',
          password: 'correctpassword'
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'wrongpass@example.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid email or password');
      });
    });

    describe('with invalid data format', () => {
      it('should return 400 when email is invalid format', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'not-an-email',
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });

      it('should return 400 when password is missing', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('should return success message when authenticated', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .post('/auth/logout')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });
  
  describe('GET /auth/profile', () => {
    it('should return user profile when authenticated', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get('/auth/profile')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.username).toBe(testUser.username);
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.role).toBe('user');
      expect(response.body.booksCount).toBe(0);
      expect(response.body.favoritesCount).toBe(0);
      expect(response.body.totalBooksRead).toBe(0);
      expect(response.body.password).toBeUndefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/auth/profile');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set(authHeader('invalid_token'));

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /auth/profile', () => {
    it('should update username successfully', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/profile')
        .set(authHeader(testUser.token))
        .send({ username: 'newusername' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.user.username).toBe('newusername');
    });

    it('should update email successfully', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/profile')
        .set(authHeader(testUser.token))
        .send({ email: 'newemail@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('newemail@example.com');
    });

    it('should return 409 when username is already taken', async () => {
      await createTestUser({ username: 'takenusername' });
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/profile')
        .set(authHeader(testUser.token))
        .send({ username: 'takenusername' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Username already taken');
    });

    it('should return 409 when email is already taken', async () => {
      await createTestUser({ email: 'taken@example.com' });
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/profile')
        .set(authHeader(testUser.token))
        .send({ email: 'taken@example.com' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email already exists');
    });

    it('should return 400 for invalid username length', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/profile')
        .set(authHeader(testUser.token))
        .send({ username: 'ab' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/profile')
        .set(authHeader(testUser.token))
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/auth/profile')
        .send({ username: 'newname' });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /auth/password', () => {
    it('should change password successfully', async () => {
      const testUser = await createTestUser({ password: 'oldpassword' });

      const response = await request(app)
        .put('/auth/password')
        .set(authHeader(testUser.token))
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password updated successfully');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'newpassword123'
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should return 401 when current password is incorrect', async () => {
      const testUser = await createTestUser({ password: 'correctpassword' });

      const response = await request(app)
        .put('/auth/password')
        .set(authHeader(testUser.token))
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Current password is incorrect');
    });

    it('should return 400 when new password is too short', async () => {
      const testUser = await createTestUser({ password: 'oldpassword' });

      const response = await request(app)
        .put('/auth/password')
        .set(authHeader(testUser.token))
        .send({
          currentPassword: 'oldpassword',
          newPassword: '12345'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when current password is missing', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .put('/auth/password')
        .set(authHeader(testUser.token))
        .send({
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/auth/password')
        .send({
          currentPassword: 'old',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/verify', () => {
    it('should return valid status and user info with valid token', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get('/auth/verify')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser._id);
      expect(response.body.user.role).toBe('user');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/auth/verify')
        .set(authHeader('invalid_token'));

      expect(response.status).toBe(401);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/auth/verify');

      expect(response.status).toBe(401);
    });
  });
});
