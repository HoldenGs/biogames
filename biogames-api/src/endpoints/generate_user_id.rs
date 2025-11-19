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
#[cfg(not(feature = "allow_email_reuse"))]
use crate::schema::email_registry;
#[cfg(not(feature = "allow_email_reuse"))]
use sha2::Sha256;
#[cfg(not(feature = "allow_email_reuse"))]
use sha2::Digest;
#[cfg(not(feature = "allow_email_reuse"))]
use hex;
use std::string::String;

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

#[cfg(not(feature = "allow_email_reuse"))]
fn hash_email(email: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(email.to_lowercase().as_bytes());
    hex::encode(hasher.finalize())
}

pub fn send_user_email(user_id: &str, email: &str) {
    let email_body = format!(
        r#"To: {email}
Subject: Your BioGames User ID

Your user ID is: {user_id}

Hello,

Thank you for registering for the BioGames platform.
Your assigned user ID is: {user_id}

DO NOT SHARE YOUR USER ID, AND PLEASE SAVE IT, AS IT’S CRITICAL FOR RECEIVING YOUR PRIZE.

If you have any questions, please contact the BioGames team.

Thank you,
The BioGames Team

------------------------------------------------------------------------------

University of California, Los Angeles

Evaluating the BioGames Platform as a Competitive Learning Tool for Training Diagnostic Accuracy in Breast Tissue Scoring

INFORMATION SHEET FOR PARTICIPANTS

INTRODUCTION

The Ozcan Research Group, from the Department of Electrical Engineering at the University of California, Los
Angeles (UCLA), is conducting a research study. You are being invited to participate because you are currently
enrolled in an ACGME-I-accredited pathology residency program. Your participation in this research study is entirely
voluntary.

WHAT SHOULD I KNOW ABOUT A RESEARCH STUDY?

• Whether or not you take part in the study is up to you.
• You can choose not to take part.
• You can agree to take part and later change your mind.
• Your decision will not be held against you.
• You can ask all the questions you want before you decide.

WHY IS THIS RESEARCH BEING DONE?

This study evaluates the effectiveness of the BioGames platform in training pathology residents to accurately score
clinical datasets, specifically Her2-stained breast tissue biopsies. The goal is to determine whether BioGames can
improve diagnostic accuracy and efficiency through a gamified, interactive training experience.

HOW LONG WILL THE RESEARCH LAST AND WHAT WILL I NEED TO DO?

Participation will take approximately 30 minutes over the course of a month. You will be asked to complete a pre-test,
post-test, and at least one practice session.

Pre-test and Post-test: Each will take about 5 minutes.
Practice Sessions: Each session will take 2 - 3 minutes. You are encouraged to play multiple times.

Participation includes the following steps:
1. Complete a pre-test to assess your baseline diagnostic skills.
2. Use the BioGames platform over a two-week period for practice and competition.
3. Complete a post-test to evaluate any improvement.

ARE THERE ANY RISKS IF I PARTICIPATE?

There are no known risks or discomforts associated with participation in this study. However, if you feel any
discomfort while using the platform, you may stop at any time.

ARE THERE ANY BENEFITS IF I PARTICIPATE?

We cannot promise any benefits to others from your taking part in this research. However, the study may benefit
others by enhancing their diagnostic skill and accurately score Her2-stained breast tissue biopsies in the future.

WHAT OTHER CHOICES DO I HAVE IF I CHOSE NOT TO PARTICIPATE?

Your participation in this study is entirely voluntary. You may refuse to participate or withdraw from the study at any
time without penalty or loss of benefits to which you are otherwise entitled. If you choose to withdraw, your data will
be discarded.

HOW WILL INFORMATION ABOUT ME AND MY PARTICIPATION BE KEPT CONFIDENTIAL?

The researchers will do their best to make sure that your private information is kept confidential. Information about
you will be handled as confidentially as possible, but participating in research may involve a loss of privacy and the
potential for a breach in confidentiality. Study data will be physically and electronically secured.  As with any use of
electronic means to store data, there is a risk of breach of data security.

Use of personal information that can identify you:

You will receive a unique access code from the study coordinator at your program. Your only personal information
that will be collected is your mednet email.

How information about you will be stored:

All study material will be stored in an encrypted drive that will be accessible only to a small number of authorized
people involved in this project. The research team will carefully follow the coding, storage, and data sharing plan
explained below. No identifiable information about you will be kept with the research data. All research data and
records will be stored on a securely encrypted system.

People and agencies that will have access to your information:

The research team and authorized UCLA personnel may have access to study data and records to monitor the study.
 Research records provided to authorized, non-UCLA personnel will not contain identifiable information about you.
Publications and/or presentations that result from this study will not identify you by name.

Employees of the University may have access to identifiable information as part of routine processing of your
information, such as lab work or processing payment. However, University employees are bound by strict rules of
confidentiality.

How long information from the study will be kept:

Data collected from participants will be kept for a minimum of 3 years after the completion of the study or the last
published result, whichever is later, in accordance with federal regulations and institutional policies. This is to ensure
that the data is available for any audits, reviews, or further analysis. Your data, including de-identified data may be
kept for use in future research, including research that is not currently known. If you do not want your data to be used
for future research, you should not participate in this study.

WILL I BE PAID FOR MY PARTICIPATION?

The top 2 participants in the competition will be eligible to receive a gift card valued at under $100 as a reward for
their efforts.
In addition, 3 random participants will be selected, independently of their performance, to receive a $50 gift card.

WHO CAN I CONTACT IF I HAVE QUESTIONS ABOUT THIS STUDY?

The research team:
If you have any questions, comments, or concerns about the research, you can contact postdoctoral scholar Paloma
Casteleiro Costa (casteleiro@ucla.edu) or medical student Brian Qinyu Cheng (bqcheng@mednet.ucla.edu). If you
have any questions, comments, or concerns about the study team, you can talk to the study PI Dr. Aydogan Ozcan
(ozcan@ee.ucla.edu).

UCLA Office of the Human Research Protection Program (OHRPP):

If you have questions about your rights as a research subject, or you have concerns or suggestions and you want to
talk to someone other than the researchers, you may contact the UCLA OHRPP by phone: (310) 206-2040; by
email: participants@research.ucla.edu or by mail: Box 951406, Los Angeles, CA 90095-1406.

WHAT ARE MY RIGHTS IF I TAKE PART IN THIS STUDY?

• You can choose whether or not you want to be in this study, and you may withdraw your consent and discontinue
participation at any time.
• Whatever decision you make, there will be no penalty to you, and no loss of benefits to which you were otherwise
entitled.
• You may refuse to answer any questions that you do not want to answer and still remain in the study.
"#,
        email = email,
        user_id = user_id,
    );

    if let Ok(mut child) = Command::new("sendmail")
        .arg("-t")
        .stdin(Stdio::piped())
        .spawn()
    {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(email_body.as_bytes());
        }
        let _ = child.wait();
    } else {
        eprintln!("Failed to send email to {}", email);
    }
}

pub async fn generate_user_id(
    ValidatedRequest(payload): ValidatedRequest<GenerateUserIdRequest>,
) -> impl IntoResponse {
    let connection = &mut establish_db_connection();


    // Validate that it's an allowed email
    if !payload.email.ends_with("@ucla.edu") && !payload.email.ends_with("@mednet.ucla.edu") && !payload.email.ends_with("@mail.huji.ac.il") && !payload.email.ends_with("@hadassah.org.il") {
        return GenerateUserIdResponse {
            success: false,
            user_id: String::new(),
            message: "Only UCLA email addresses are allowed".to_string(),
        }.into_response();
    }

    // Check if the email is used already (only if email reuse is not allowed)
    #[cfg(not(feature = "allow_email_reuse"))]
    {
        let email_hash = hash_email(&payload.email);

        let email_exists = diesel::dsl::select(diesel::dsl::exists(
            email_registry::table.filter(email_registry::email_hash.eq(email_hash.clone()))
        )).get_result::<bool>(connection).unwrap_or(false);

        if email_exists {
            return GenerateUserIdResponse {
                success: false,
                user_id: String::new(),
                message: "This email address has already been used! Please use your existing user_id or contact an admin if you don't have it.".to_string()
            }.into_response();
        }
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

    // Record email hash for tracking (only if email reuse prevention is enabled)
    #[cfg(not(feature = "allow_email_reuse"))]
    {
        let email_hash = hash_email(&payload.email);
        match insert_into(email_registry::table)
            .values(email_registry::email_hash.eq(&email_hash.clone()))
            .execute(connection) {
                Ok(_) => println!("-> Email hash has been recorded"),
                Err(e) => {
                    eprintln!("Error inserting mail hash: {}", e);
                    return GenerateUserIdResponse {
                        success: false,
                        user_id: String::new(),
                        message: format!("Database error while recording email: {}", e),
                    }.into_response();
                }
            }
    }

    #[cfg(feature = "allow_email_reuse")]
    {
        println!("-> Email reuse is allowed, skipping email hash recording");
    }

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

    // Send the email
    send_user_email(&user_id, &payload.email);

    GenerateUserIdResponse {
        success: true,
        user_id,
        message: "User ID generated successfully. In production, this would be emailed to the provided address.".to_string(),
    }.into_response()

}