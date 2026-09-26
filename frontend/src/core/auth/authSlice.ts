import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '@/core/api/client';
import { isApiError } from '@/core/api/error';
import type { AuthUser, LoginRequest } from '@/core/api/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated';
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'idle',
  error: null,
};

export const login = createAsyncThunk<
  { accessToken: string; user: AuthUser },
  LoginRequest,
  { rejectValue: string }
>('auth/login', async (req, { rejectWithValue }) => {
  try {
    const res = await api.login(req);
    return res;
  } catch (e) {
    return rejectWithValue(isApiError(e) ? e.message : 'Login failed');
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await api.logout();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.status = 'idle';
        state.user = null;
        state.accessToken = null;
      });
  },
});

export const { setAccessToken, clearError } = authSlice.actions;
export default authSlice.reducer;
