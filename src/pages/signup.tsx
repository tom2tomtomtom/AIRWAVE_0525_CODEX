import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon} from '@mui/icons-material';

const SignupPage: React.FC = () => {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validation
      if (!name || !email || !password || !confirmPassword) {
        setError('Please fill in all fields');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return;
      }

      // Use the AuthContext signup function
      await signup(email, password, name);

      // Redirect to dashboard on successful signup
      router.push('/dashboard');
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Signup error:', err);
      }
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
       <Head>
        <title>Sign Up | AIrFLOW</title>
      </Head>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#030712', // Carbon Black primary background
          padding: 3 }}
      >
        <Paper
          elevation={24}
          sx={{
            p: 4,
            maxWidth: 400,
            width: '100%',
            borderRadius: 3 }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #FBBF24, #F59E0B)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1 }}
            >
              AIrFLOW
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Create Your Account
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} data-testid="error-message">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} data-testid="signup-form">
            <TextField
              fullWidth
              label="Full Name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
              data-testid="name-input"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                )}}
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
              data-testid="email-input"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                )}}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
              helperText="Must be at least 8 characters long"
              data-testid="password-input"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Icon button"
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )}}
            />

            <TextField
              fullWidth
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConfirmPassword(e.target.value)
              }
              disabled={loading}
              sx={{ mb: 3 }}
              data-testid="confirm-password-input"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label="Icon button"
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )}}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              data-testid="sign-up-button"
              sx={{
                mb: 3,
                height: 48,
                backgroundColor: '#FBBF24', // Carbon Black amber
                color: '#000000',
                '&:hover': {
                  backgroundColor: '#F59E0B',
                  boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.3)'}}}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </form>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link href="/login" sx={{ color: '#FBBF24', textDecoration: 'none' }}>
                Sign in
              </Link>
            </Typography>
          </Box>

          <Box
            sx={{
              mt: 3,
              p: 2,
              bgcolor: '#111827',
              borderRadius: 2,
              border: '1px solid rgba(251, 191, 36, 0.2)'}}
          >
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              <strong>Note:</strong> By creating an account, you agree to our Terms of Service and
              Privacy Policy.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </>
  );
};

export default SignupPage;
