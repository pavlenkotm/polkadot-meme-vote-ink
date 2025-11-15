#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod meme_vote {
    use ink::storage::Mapping;
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;

    /// Структура мема
    #[derive(Debug, Clone, PartialEq, scale::Encode, scale::Decode)]
    #[cfg_attr(
        feature = "std",
        derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout)
    )]
    pub struct Meme {
        pub id: u32,
        pub creator: AccountId,
        pub title: String,
        pub url: String,
        pub likes: u32,
    }

    /// Ошибки контракта
    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// Заголовок слишком длинный (> 100 символов)
        TitleTooLong,
        /// URL не может быть пустым
        EmptyUrl,
        /// Мем не существует
        MemeNotFound,
        /// Пользователь уже проголосовал за этот мем
        AlreadyVoted,
    }

    /// Результат операций контракта
    pub type Result<T> = core::result::Result<T, Error>;

    /// События контракта
    #[ink(event)]
    pub struct MemeAdded {
        #[ink(topic)]
        id: u32,
        #[ink(topic)]
        creator: AccountId,
        title: String,
        url: String,
    }

    #[ink(event)]
    pub struct Voted {
        #[ink(topic)]
        meme_id: u32,
        #[ink(topic)]
        voter: AccountId,
    }

    /// Основное хранилище контракта
    #[ink(storage)]
    pub struct MemeVote {
        /// Хранилище мемов по ID
        memes: Mapping<u32, Meme>,
        /// Следующий ID для нового мема
        next_id: u32,
        /// Отслеживание голосов: (AccountId, meme_id) -> bool
        voted: Mapping<(AccountId, u32), bool>,
    }

    impl MemeVote {
        /// Конструктор контракта
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                memes: Mapping::default(),
                next_id: 1,
                voted: Mapping::default(),
            }
        }

        /// Конструктор по умолчанию
        #[ink(constructor)]
        pub fn default() -> Self {
            Self::new()
        }

        /// Добавить новый мем
        #[ink(message)]
        pub fn add_meme(&mut self, title: String, url: String) -> Result<u32> {
            // Проверка длины заголовка
            if title.len() > 100 {
                return Err(Error::TitleTooLong);
            }

            // Проверка что URL не пустой
            if url.is_empty() {
                return Err(Error::EmptyUrl);
            }

            let caller = self.env().caller();
            let meme_id = self.next_id;

            let meme = Meme {
                id: meme_id,
                creator: caller,
                title: title.clone(),
                url: url.clone(),
                likes: 0,
            };

            self.memes.insert(meme_id, &meme);
            self.next_id += 1;

            // Генерируем событие
            self.env().emit_event(MemeAdded {
                id: meme_id,
                creator: caller,
                title,
                url,
            });

            Ok(meme_id)
        }

        /// Проголосовать за мем (лайк)
        #[ink(message)]
        pub fn vote_up(&mut self, meme_id: u32) -> Result<()> {
            let caller = self.env().caller();

            // Проверяем что мем существует
            let mut meme = self.memes.get(meme_id).ok_or(Error::MemeNotFound)?;

            // Проверяем что пользователь еще не голосовал
            let vote_key = (caller, meme_id);
            if self.voted.get(vote_key).unwrap_or(false) {
                return Err(Error::AlreadyVoted);
            }

            // Увеличиваем счетчик лайков
            meme.likes += 1;
            self.memes.insert(meme_id, &meme);

            // Отмечаем что пользователь проголосовал
            self.voted.insert(vote_key, &true);

            // Генерируем событие
            self.env().emit_event(Voted {
                meme_id,
                voter: caller,
            });

            Ok(())
        }

        /// Получить мем по ID
        #[ink(message)]
        pub fn get_meme(&self, meme_id: u32) -> Option<Meme> {
            self.memes.get(meme_id)
        }

        /// Получить список мемов с пагинацией
        #[ink(message)]
        pub fn get_memes(&self, from: u32, limit: u32) -> Vec<Meme> {
            let mut result = Vec::new();
            let mut count = 0;

            for id in from..self.next_id {
                if count >= limit {
                    break;
                }

                if let Some(meme) = self.memes.get(id) {
                    result.push(meme);
                    count += 1;
                }
            }

            result
        }

        /// Получить топ мемов по количеству лайков
        #[ink(message)]
        pub fn get_top_memes(&self, limit: u32) -> Vec<Meme> {
            let mut memes = Vec::new();

            // Собираем все мемы
            for id in 1..self.next_id {
                if let Some(meme) = self.memes.get(id) {
                    memes.push(meme);
                }
            }

            // Сортируем по количеству лайков (убывание) используя эффективную встроенную сортировку
            // Сначала по лайкам (больше = выше), затем по ID (меньше = выше) для стабильности
            memes.sort_by(|a, b| {
                b.likes.cmp(&a.likes).then_with(|| a.id.cmp(&b.id))
            });

            // Берем только указанное количество
            memes.truncate(limit as usize);
            memes
        }

        /// Проверить, голосовал ли пользователь за мем
        #[ink(message)]
        pub fn has_voted(&self, account: AccountId, meme_id: u32) -> bool {
            self.voted.get((account, meme_id)).unwrap_or(false)
        }

        /// Получить общее количество мемов
        #[ink(message)]
        pub fn total_memes(&self) -> u32 {
            self.next_id - 1
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn new_works() {
            let contract = MemeVote::new();
            assert_eq!(contract.total_memes(), 0);
        }

        #[ink::test]
        fn add_meme_works() {
            let mut contract = MemeVote::new();
            let title = String::from("Funny Cat");
            let url = String::from("https://example.com/cat.jpg");

            let result = contract.add_meme(title.clone(), url.clone());
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), 1);
            assert_eq!(contract.total_memes(), 1);

            let meme = contract.get_meme(1);
            assert!(meme.is_some());
            let meme = meme.unwrap();
            assert_eq!(meme.title, title);
            assert_eq!(meme.url, url);
            assert_eq!(meme.likes, 0);
        }

        #[ink::test]
        fn add_meme_title_too_long() {
            let mut contract = MemeVote::new();
            let long_title = String::from("a").repeat(101);
            let url = String::from("https://example.com/image.jpg");

            let result = contract.add_meme(long_title, url);
            assert_eq!(result, Err(Error::TitleTooLong));
        }

        #[ink::test]
        fn add_meme_empty_url() {
            let mut contract = MemeVote::new();
            let title = String::from("Test");
            let url = String::from("");

            let result = contract.add_meme(title, url);
            assert_eq!(result, Err(Error::EmptyUrl));
        }

        #[ink::test]
        fn vote_up_works() {
            let mut contract = MemeVote::new();
            contract
                .add_meme(
                    String::from("Meme 1"),
                    String::from("https://example.com/1.jpg"),
                )
                .unwrap();

            let result = contract.vote_up(1);
            assert!(result.is_ok());

            let meme = contract.get_meme(1).unwrap();
            assert_eq!(meme.likes, 1);
        }

        #[ink::test]
        fn vote_up_meme_not_found() {
            let mut contract = MemeVote::new();
            let result = contract.vote_up(999);
            assert_eq!(result, Err(Error::MemeNotFound));
        }

        #[ink::test]
        fn vote_up_already_voted() {
            let mut contract = MemeVote::new();
            contract
                .add_meme(
                    String::from("Meme 1"),
                    String::from("https://example.com/1.jpg"),
                )
                .unwrap();

            contract.vote_up(1).unwrap();
            let result = contract.vote_up(1);
            assert_eq!(result, Err(Error::AlreadyVoted));
        }

        #[ink::test]
        fn has_voted_works() {
            let mut contract = MemeVote::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            contract
                .add_meme(
                    String::from("Meme 1"),
                    String::from("https://example.com/1.jpg"),
                )
                .unwrap();

            assert!(!contract.has_voted(accounts.alice, 1));
            contract.vote_up(1).unwrap();
            assert!(contract.has_voted(accounts.alice, 1));
        }

        #[ink::test]
        fn get_memes_works() {
            let mut contract = MemeVote::new();

            // Добавляем несколько мемов
            for i in 1..=5 {
                contract
                    .add_meme(
                        String::from(format!("Meme {}", i)),
                        String::from(format!("https://example.com/{}.jpg", i)),
                    )
                    .unwrap();
            }

            let memes = contract.get_memes(1, 3);
            assert_eq!(memes.len(), 3);
            assert_eq!(memes[0].title, "Meme 1");
            assert_eq!(memes[2].title, "Meme 3");
        }

        #[ink::test]
        fn get_top_memes_works() {
            let mut contract = MemeVote::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            // Добавляем мемы
            for i in 1..=3 {
                contract
                    .add_meme(
                        String::from(format!("Meme {}", i)),
                        String::from(format!("https://example.com/{}.jpg", i)),
                    )
                    .unwrap();
            }

            // Голосуем: мем 2 получит больше всего лайков
            // Для теста нужно изменить caller, но в unit-тестах это ограничено
            // Поэтому просто проверим что функция работает
            contract.vote_up(2).unwrap();

            let top = contract.get_top_memes(2);
            assert_eq!(top.len(), 2);
            // Первый должен быть с наибольшим количеством лайков
            assert_eq!(top[0].id, 2);
            assert_eq!(top[0].likes, 1);
        }

        #[ink::test]
        fn multiple_memes_multiple_votes() {
            let mut contract = MemeVote::new();

            // Добавляем мемы
            contract
                .add_meme(
                    String::from("Doge"),
                    String::from("https://example.com/doge.jpg"),
                )
                .unwrap();
            contract
                .add_meme(
                    String::from("Pepe"),
                    String::from("https://example.com/pepe.jpg"),
                )
                .unwrap();
            contract
                .add_meme(
                    String::from("Cat"),
                    String::from("https://example.com/cat.jpg"),
                )
                .unwrap();

            assert_eq!(contract.total_memes(), 3);

            // Голосуем за первый мем
            contract.vote_up(1).unwrap();
            let meme1 = contract.get_meme(1).unwrap();
            assert_eq!(meme1.likes, 1);

            // Голосуем за второй мем
            contract.vote_up(2).unwrap();
            let meme2 = contract.get_meme(2).unwrap();
            assert_eq!(meme2.likes, 1);
        }
    }
}
