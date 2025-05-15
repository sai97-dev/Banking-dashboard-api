import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTransactions } from '../../store/slices/accountSlice';
import useDebounce from '../../hooks/useDebounce';

const TRANSACTION_TYPES = ['all', 'debit', 'credit', 'transfer'];
const STATUSES = ['all', 'completed', 'pending', 'failed'];

const TransactionHistory = ({ accountId }) => {
  const dispatch = useDispatch();
  const { transactions, transactionMeta, loading } = useSelector((state) => state.account);

  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    page: 1,
    limit: 20,
  });

  const debouncedFilters = useDebounce(filters, 400);

  const loadTransactions = useCallback(() => {
    const params = { ...debouncedFilters };
    if (params.type === 'all') delete params.type;
    if (params.status === 'all') delete params.status;
    dispatch(fetchTransactions({ accountId, params }));
  }, [accountId, debouncedFilters, dispatch]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="transaction-history">
      <div className="section-header">
        <h3>Transaction History</h3>
        <span className="total-count">{transactionMeta?.total || 0} transactions</span>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select value={filters.type} onChange={(e) => handleFilterChange('type', e.target.value)}>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
          placeholder="Start date"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
          placeholder="End date"
        />

        <input
          type="number"
          value={filters.minAmount}
          onChange={(e) => handleFilterChange('minAmount', e.target.value)}
          placeholder="Min $"
          min="0"
        />
        <input
          type="number"
          value={filters.maxAmount}
          onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
          placeholder="Max $"
          min="0"
        />
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="loading-spinner" aria-label="Loading transactions" />
      ) : transactions?.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found for the selected filters.</p>
        </div>
      ) : (
        <div className="transaction-list">
          {transactions?.map((txn) => (
            <div key={txn.id} className={`transaction-item ${txn.type}`}>
              <div className="txn-icon">{txn.type === 'credit' ? '↓' : '↑'}</div>
              <div className="txn-details">
                <span className="txn-description">{txn.description || 'Transaction'}</span>
                <span className="txn-reference">{txn.reference_number}</span>
                <span className="txn-counterparty">{txn.counterparty_name}</span>
              </div>
              <div className="txn-right">
                <span className={`txn-amount ${txn.type}`}>
                  {txn.type === 'credit' ? '+' : '-'}
                  {formatCurrency(txn.amount, txn.currency)}
                </span>
                <span className="txn-date">{formatDate(txn.created_at)}</span>
                <span className={`txn-status status-${txn.status}`}>{txn.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {transactionMeta && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(filters.page - 1)}
            disabled={filters.page <= 1 || loading}
          >
            ← Prev
          </button>
          <span>Page {filters.page} of {transactionMeta.totalPages}</span>
          <button
            onClick={() => handlePageChange(filters.page + 1)}
            disabled={filters.page >= transactionMeta.totalPages || loading}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default TransactionHistory;
