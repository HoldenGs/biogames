#[async_trait]
pub trait ChallengeService {
    async fn create(&mut self);
}
