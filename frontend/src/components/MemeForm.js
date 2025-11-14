import React, { useState } from 'react';

function MemeForm({ onAddMeme }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    // Валидация
    if (!title.trim()) {
      setMessage('Заголовок не может быть пустым');
      setMessageType('error');
      return;
    }

    if (title.length > 100) {
      setMessage('Заголовок не может быть длиннее 100 символов');
      setMessageType('error');
      return;
    }

    if (!url.trim()) {
      setMessage('URL не может быть пустым');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);
      const success = await onAddMeme(title, url);

      if (success !== false) {
        setMessage('Мем успешно добавлен!');
        setMessageType('success');
        setTitle('');
        setUrl('');

        // Очистить сообщение через 3 секунды
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`Ошибка: ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-meme-form">
      <h2>Добавить мем</h2>

      {message && (
        <div className={messageType === 'success' ? 'success-message' : 'error-message'}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Заголовок (макс. 100 символов)</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите заголовок мема"
            disabled={loading}
            maxLength={100}
          />
          <small style={{ color: '#6b7280', fontSize: '12px' }}>
            {title.length}/100 символов
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="url">URL изображения</label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/meme.jpg"
            disabled={loading}
          />
          <small style={{ color: '#6b7280', fontSize: '12px' }}>
            Вставьте прямую ссылку на изображение
          </small>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Добавление...' : 'Добавить мем'}
        </button>
      </form>
    </div>
  );
}

export default MemeForm;
