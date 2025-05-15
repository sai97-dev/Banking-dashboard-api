import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAccount, fetchBalance } from '../../store/slices/accountSlice';

const AccountSummary = ({ accountId }) => {
  const dispatch = useDispatch();
  const { account, balance, loading, error } = useSelector((state) => state.account);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (accountId) {
      dispatch(fetchAccount(accountId));
      dispatch(fetchBalance(accountId));
    }
  }, [accountId, dispatch]);

  const handleRefreshBalance = async () => {
    setRefreshing(true);
    await dispatch(fetchBalance(accountId));
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="account-summary skeleton">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-summary error">
        <p>Unable to load account details. Please try again.</p>
        <button onClick={() => dispatch(fetchAccount(accountId))}>Retry</button>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="account-summary">
      <div className="account-header">
        <div className="account-info">
          <h2>{account.account_type} Account</h2>
          <span className="account-number">
            •••• {account.account_number?.slice(-4)}
          </span>
        </div>
        <span className={`status-badge status-${account.status}`}>
          {account.status}
        </span>
      </div>

      <div className="balance-section">
        <div className="balance-item">
          <label>Available Balance</label>
          <span className="balance-amount">
            {formatCurrency(balance?.available_balance, balance?.currency)}
          </span>
        </div>
        <div className="balance-item">
          <label>Current Balance</label>
          <span className="balance-amount secondary">
            {formatCurrency(balance?.current_balance, balance?.currency)}
          </span>
        </div>
        <button
          className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefreshBalance}
          disabled={refreshing}
          aria-label="Refresh balance"
        >
          ↻
        </button>
      </div>

      <div className="account-meta">
        <span>Holder: {account.first_name} {account.last_name}</span>
        <span>Last activity: {formatDate(balance?.last_transaction_date)}</span>
      </div>
    </div>
  );
};

const formatCurrency = (amount, currency = 'USD') => {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

export default AccountSummary;
