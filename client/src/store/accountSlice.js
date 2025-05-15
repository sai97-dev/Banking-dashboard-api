import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const fetchAccount = createAsyncThunk(
  'account/fetchAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/accounts/${accountId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch account');
    }
  }
);

export const fetchBalance = createAsyncThunk(
  'account/fetchBalance',
  async (accountId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/accounts/${accountId}/balance`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch balance');
    }
  }
);

export const fetchTransactions = createAsyncThunk(
  'account/fetchTransactions',
  async ({ accountId, params }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/accounts/${accountId}/transactions`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch transactions');
    }
  }
);

export const initiateTransfer = createAsyncThunk(
  'account/initiateTransfer',
  async (transferData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/payments/transfer', transferData);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Transfer failed');
    }
  }
);

const accountSlice = createSlice({
  name: 'account',
  initialState: {
    account: null,
    balance: null,
    transactions: [],
    transactionMeta: null,
    loading: false,
    error: null,
    transferStatus: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    resetTransferStatus: (state) => { state.transferStatus = null; },
  },
  extraReducers: (builder) => {
    // fetchAccount
    builder
      .addCase(fetchAccount.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.account = action.payload;
      })
      .addCase(fetchAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // fetchBalance
    builder
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.balance = action.payload;
      });

    // fetchTransactions
    builder
      .addCase(fetchTransactions.pending, (state) => { state.loading = true; })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload.data;
        state.transactionMeta = action.payload.pagination;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // initiateTransfer
    builder
      .addCase(initiateTransfer.pending, (state) => { state.transferStatus = 'loading'; })
      .addCase(initiateTransfer.fulfilled, (state) => { state.transferStatus = 'success'; })
      .addCase(initiateTransfer.rejected, (state, action) => {
        state.transferStatus = 'error';
        state.error = action.payload;
      });
  },
});

export const { clearError, resetTransferStatus } = accountSlice.actions;
export default accountSlice.reducer;
