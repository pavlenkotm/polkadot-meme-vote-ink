import React, { useState, useEffect } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import MemeForm from './components/MemeForm';
import MemeList from './components/MemeList';
import contractMetadata from './contract/metadata.json';

function App() {
  const [api, setApi] = useState(null);
  const [contract, setContract] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'top'

  // Адрес развернутого контракта (замените на свой после деплоя)
  const CONTRACT_ADDRESS = 'YOUR_CONTRACT_ADDRESS_HERE';

  // WebSocket endpoint (замените на нужный)
  // Примеры:
  // - Local contracts-node: ws://127.0.0.1:9944
  // - Aleph Zero Testnet: wss://ws.test.azero.dev
  // - Astar Shibuya: wss://rpc.shibuya.astar.network
  const WS_PROVIDER = 'ws://127.0.0.1:9944';

  // Инициализация API и подключение к контракту
  useEffect(() => {
    const initApi = async () => {
      try {
        setLoading(true);

        // Подключаемся к ноде
        const wsProvider = new WsProvider(WS_PROVIDER);
        const apiInstance = await ApiPromise.create({ provider: wsProvider });
        setApi(apiInstance);

        // Подключаемся к контракту
        const contractInstance = new ContractPromise(
          apiInstance,
          contractMetadata,
          CONTRACT_ADDRESS
        );
        setContract(contractInstance);

        // Подключаем расширение Polkadot.js
        const extensions = await web3Enable('MemeVote DApp');
        if (extensions.length === 0) {
          setError('Polkadot.js Extension не установлено. Установите расширение для продолжения.');
          setLoading(false);
          return;
        }

        // Получаем аккаунты
        const allAccounts = await web3Accounts();
        setAccounts(allAccounts);

        if (allAccounts.length > 0) {
          setSelectedAccount(allAccounts[0]);
        }

        setLoading(false);
      } catch (err) {
        console.error('Ошибка инициализации:', err);
        setError(`Ошибка подключения: ${err.message}`);
        setLoading(false);
      }
    };

    initApi();
  }, []);

  // Загрузка мемов
  useEffect(() => {
    if (contract && api) {
      loadMemes();
    }
  }, [contract, api, activeTab]);

  const loadMemes = async () => {
    try {
      const gasLimit = api.registry.createType('WeightV2', {
        refTime: 3000000000,
        proofSize: 1000000,
      });

      let result;

      if (activeTab === 'top') {
        // Загружаем топ мемов
        const { result: queryResult } = await contract.query.getTopMemes(
          selectedAccount?.address || accounts[0]?.address || '',
          { gasLimit },
          10 // top 10
        );
        result = queryResult;
      } else {
        // Загружаем все мемы
        const { result: queryResult } = await contract.query.getMemes(
          selectedAccount?.address || accounts[0]?.address || '',
          { gasLimit },
          1,  // from
          100 // limit
        );
        result = queryResult;
      }

      if (result.isOk) {
        const memesData = result.asOk.toHuman();
        setMemes(Array.isArray(memesData) ? memesData : []);
      }
    } catch (err) {
      console.error('Ошибка загрузки мемов:', err);
    }
  };

  const handleAddMeme = async (title, url) => {
    if (!contract || !selectedAccount) {
      setError('Подключите аккаунт для добавления мема');
      return false;
    }

    try {
      const injector = await web3FromAddress(selectedAccount.address);

      const gasLimit = api.registry.createType('WeightV2', {
        refTime: 3000000000,
        proofSize: 1000000,
      });

      return new Promise((resolve, reject) => {
        contract.tx
          .addMeme({ gasLimit }, title, url)
          .signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, events, dispatchError }) => {
            if (status.isInBlock) {
              console.log(`Транзакция в блоке: ${status.asInBlock}`);

              // Проверяем на ошибки
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  const { docs, name, section } = decoded;
                  setError(`Ошибка контракта: ${section}.${name}: ${docs.join(' ')}`);
                  reject(new Error(`${section}.${name}`));
                } else {
                  setError(`Ошибка транзакции: ${dispatchError.toString()}`);
                  reject(dispatchError);
                }
              } else {
                // Перезагружаем мемы после успешного добавления
                setTimeout(loadMemes, 2000);
                resolve(true);
              }
            }
          })
          .catch((err) => {
            console.error('Ошибка отправки транзакции:', err);
            setError(`Не удалось отправить транзакцию: ${err.message}`);
            reject(err);
          });
      });
    } catch (err) {
      console.error('Ошибка добавления мема:', err);
      setError(`Ошибка: ${err.message}`);
      return false;
    }
  };

  const handleVote = async (memeId) => {
    if (!contract || !selectedAccount) {
      setError('Подключите аккаунт для голосования');
      return false;
    }

    try {
      const injector = await web3FromAddress(selectedAccount.address);

      const gasLimit = api.registry.createType('WeightV2', {
        refTime: 3000000000,
        proofSize: 1000000,
      });

      return new Promise((resolve, reject) => {
        contract.tx
          .voteUp({ gasLimit }, memeId)
          .signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, dispatchError }) => {
            if (status.isInBlock) {
              console.log(`Голос записан в блоке: ${status.asInBlock}`);

              // Проверяем на ошибки
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  const { docs, name, section } = decoded;
                  setError(`Ошибка голосования: ${section}.${name}: ${docs.join(' ')}`);
                  reject(new Error(`${section}.${name}`));
                } else {
                  setError(`Ошибка транзакции: ${dispatchError.toString()}`);
                  reject(dispatchError);
                }
              } else {
                // Перезагружаем мемы после успешного голосования
                setTimeout(loadMemes, 2000);
                resolve(true);
              }
            }
          })
          .catch((err) => {
            console.error('Ошибка отправки голоса:', err);
            setError(`Не удалось отправить голос: ${err.message}`);
            reject(err);
          });
      });
    } catch (err) {
      console.error('Ошибка голосования:', err);
      setError(`Ошибка: ${err.message}`);
      return false;
    }
  };

  const checkIfVoted = async (memeId) => {
    if (!contract || !selectedAccount) return false;

    try {
      const gasLimit = api.registry.createType('WeightV2', {
        refTime: 3000000000,
        proofSize: 1000000,
      });

      const { result } = await contract.query.hasVoted(
        selectedAccount.address,
        { gasLimit },
        selectedAccount.address,
        memeId
      );

      if (result.isOk) {
        return result.asOk.toHuman();
      }
      return false;
    } catch (err) {
      console.error('Ошибка проверки голоса:', err);
      return false;
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="App">
      <header>
        <h1>MemeVote - On-chain Голосование</h1>
        <p>Децентрализованное голосование за мемы на Polkadot</p>

        <div className="connection-status">
          <span className={`status-badge ${api ? 'status-connected' : 'status-disconnected'}`}>
            {api ? '✓ Подключено к сети' : '✗ Не подключено'}
          </span>

          {accounts.length > 0 && (
            <select
              value={selectedAccount?.address || ''}
              onChange={(e) => {
                const account = accounts.find(acc => acc.address === e.target.value);
                setSelectedAccount(account);
              }}
              style={{ padding: '8px', borderRadius: '5px', border: '2px solid #e5e7eb' }}
            >
              {accounts.map((account) => (
                <option key={account.address} value={account.address}>
                  {account.meta.name || account.address.slice(0, 8)}...
                </option>
              ))}
            </select>
          )}

          {selectedAccount && (
            <span className="status-badge status-connected">
              {selectedAccount.meta.name}
            </span>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ marginTop: '10px' }}>
            {error}
            <button
              onClick={() => setError('')}
              style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {contract && selectedAccount && (
        <MemeForm onAddMeme={handleAddMeme} />
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Все мемы
        </button>
        <button
          className={`tab ${activeTab === 'top' ? 'active' : ''}`}
          onClick={() => setActiveTab('top')}
        >
          Топ мемов
        </button>
      </div>

      <MemeList
        memes={memes}
        onVote={handleVote}
        checkIfVoted={checkIfVoted}
        currentAccount={selectedAccount}
      />
    </div>
  );
}

export default App;
