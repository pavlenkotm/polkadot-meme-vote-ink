import React from 'react';
import MemeCard from './MemeCard';

function MemeList({ memes, onVote, checkIfVoted, currentAccount }) {
  if (!memes || memes.length === 0) {
    return (
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '10px',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <h3>Мемов пока нет</h3>
        <p>Будьте первым, кто добавит мем!</p>
      </div>
    );
  }

  return (
    <div className="meme-list">
      {memes.map((meme, index) => (
        <MemeCard
          key={meme.id || index}
          meme={meme}
          onVote={onVote}
          checkIfVoted={checkIfVoted}
          currentAccount={currentAccount}
        />
      ))}
    </div>
  );
}

export default MemeList;
