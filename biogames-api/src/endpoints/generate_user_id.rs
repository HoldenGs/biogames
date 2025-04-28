use axum::{
    response::IntoResponse,
    Json,
};
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl};
use rand::{thread_rng, Rng};
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use validator::Validate;
use std::process::{Command, Stdio};
use std::io::Write;

use crate::establish_db_connection;
use crate::models::{ValidatedRequest, NewRegisteredUser};
use crate::schema::registered_users;
use diesel::insert_into;

// Dictionary of common words to use in ID generation
const WORDS: &[&str] = &[
    "cell", "tissue", "gene", "genome", "chromosome", "protein", "enzyme", "nucleus", "mitosis", "meiosis", "cytoplasm", "organelle", "mitochondria", "ribosome", "lysosome", "golgi", "endoplasmic", "reticulum", "plasma", "membrane", "cytoskeleton", "microtubule", "microfilament", "filament", "centrosome", "centromere", "telomere", "chromatin", "transcriptome", "proteome", "metabolome", "epigenetics", "biochemistry", "biophysics", "genetics", "immunology", "virology", "microbiology", "bacteria", "virus", "fungus", "parasite", "pathogen", "antigen", "antibody", "vaccine", "neuroscience", "physiology", "ecology", "evolution", "taxonomy", "botany", "zoology", "ornithology", "entomology", "paleontology", "taxonomy", "phylogeny", "epidemiology", "pharmacology", "toxicology", "oncology", "hematology", "taxonomy", "ecology", "conservation", "biodiversity", "biotechnology", "bioinformatics", "synthetic", "nanotechnology", "stemcell", "receptor", "ligand", "hormone", "cytokine", "neurotransmitter", "photosynthesis", "respiration", "metabolism", "homeostasis", "biosynthesis", "degradation", "signaling", "diagnosis", "therapy", "treatment", "cure"
];

#[derive(Deserialize, Validate)]
pub struct GenerateUserIdRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

#[derive(Serialize)]
pub struct GenerateUserIdResponse {
    pub success: bool,
    pub user_id: String,
    pub message: String,
}

impl IntoResponse for GenerateUserIdResponse {
    fn into_response(self) -> axum::response::Response {
        (axum::http::StatusCode::OK, Json(self)).into_response()
    }
}

pub async fn generate_user_id(
    ValidatedRequest(payload): ValidatedRequest<GenerateUserIdRequest>,
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();

    // Validate that it's a UCLA email
    if !payload.email.ends_with("@ucla.edu") && !payload.email.ends_with("@mednet.ucla.edu") {
        return GenerateUserIdResponse {
            success: false,
            user_id: String::new(),
            message: "Only UCLA email addresses are allowed".to_string(),
        }.into_response();
    }

    // Generate a unique user ID
    let user_id = loop {
        // Select a random word
        let word = WORDS.choose(&mut thread_rng()).unwrap();
        
        // Generate 2 random digits
        let digits: String = (0..2)
            .map(|_| thread_rng().gen_range(0..10).to_string())
            .collect();
        
        // Format the ID as "UCLA_word##"
        let id = format!("UCLA_{}{}", word, digits);
        
        // Check if this ID is already used
        let id_exists = diesel::dsl::select(diesel::dsl::exists(
            registered_users::table.filter(registered_users::user_id.eq(&id)),
        ))
        .get_result::<bool>(connection)
        .unwrap_or(false);
        
        if !id_exists {
            break id;
        }
    };

    // Insert the new user_id (without username) into the database so further checks will succeed
    let new_user = NewRegisteredUser { user_id: user_id.clone(), username: None };
    match insert_into(registered_users::table)
        .values(&new_user)
        .execute(connection) {
            Ok(count) => println!("→ Inserted {} row(s) for user_id {}", count, user_id),
        Err(e) => {
            eprintln!("Error inserting new user_id into database: {}", e);
            return GenerateUserIdResponse {
                success: false,
                user_id: String::new(),
                message: format!("Database insertion error: {}", e),
            }.into_response();
        }
    }

    // Attempt to send the user ID via the local sendmail binary
    if let Ok(mut child) = Command::new("sendmail").arg("-t").stdin(Stdio::piped()).spawn() {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = writeln!(stdin, "To: {}", payload.email);
            let _ = writeln!(stdin, "Subject: Your BioGames User ID\n");
            let _ = writeln!(stdin, "Your user ID is: {}", user_id);
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Hello,");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Thank you for registering for the BioGames platform.");
            let _ = writeln!(stdin, "Your assigned user ID is: {}", user_id);
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "DO NOT SHARE THIS INFO AND PLEASE SAVE THIS INFORMATION, AS IT’S CRITICAL FOR RECEIVING YOUR PRIZE.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "If you have any questions, please contact the BioGames team.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Thank you,");
            let _ = writeln!(stdin, "The BioGames Team");
        }
        let _ = child.wait();
    } else {
        eprintln!("Failed to spawn sendmail for {}", payload.email);
    }

    GenerateUserIdResponse {
        success: true,
        user_id,
        message: "User ID generated successfully. In production, this would be emailed to the provided address.".to_string(),
    }.into_response()

    // TODO: add email text here and actually get it sent out

} 