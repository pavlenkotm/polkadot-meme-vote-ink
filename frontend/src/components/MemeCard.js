import React, { useState, useEffect } from 'react';

function MemeCard({ meme, onVote, checkIfVoted, currentAccount }) {
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const checkVote = async () => {
      if (meme.id && currentAccount) {
        const voted = await checkIfVoted(meme.id);
        setHasVoted(voted);
      }
    };
    checkVote();
  }, [meme.id, currentAccount, checkIfVoted]);

  const handleVote = async () => {
    if (hasVoted || voting) return;

    setVoting(true);
    try {
      await onVote(meme.id);
      setHasVoted(true);
    } catch (err) {
      console.error('Ошибка голосования:', err);
    } finally {
      setVoting(false);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="meme-card">
      {!imageError ? (
        <img
          src={meme.url}
          alt={meme.title}
          className="meme-image"
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          className="meme-image"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f3f4f6',
            color: '#9ca3af'
          }}
        >
          Не удалось загрузить изображение
        </div>
      )}

      <div className="meme-content">
        <h3 className="meme-title">{meme.title}</h3>

        <div className="meme-meta">
          <span className="meme-creator" title={meme.creator}>
            Автор: {formatAddress(meme.creator)}
          </span>
          <span>ID: {meme.id}</span>
        </div>

        <div className="meme-actions">
          <button
            onClick={handleVote}
            disabled={hasVoted || voting}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            {voting ? 'Голосование...' : hasVoted ? 'Вы проголосовали' : '👍 Лайк'}
          </button>

          <div className="like-count">
            <span>❤️</span>
            <span>{meme.likes || 0}</span>
          </div>
        </div>

        {hasVoted && (
          <div className="voted-badge" style={{ marginTop: '10px', textAlign: 'center' }}>
            ✓ Вы проголосовали за этот мем
          </div>
        )}
      </div>
    </div>
  );
}

export default MemeCard;
