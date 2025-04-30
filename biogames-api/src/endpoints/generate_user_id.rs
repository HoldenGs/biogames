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
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "University of California, Los Angeles");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Study Information Sheet");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Evaluating the BioGames Platform as a Competitive Learning Tool for Training Diagnostic Accuracy in Breast Tissue Scoring");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "INTRODUCTION");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Principle Investigator, Brian Qinyu Cheng, and Faculty Sponsor, Dr. Aydogan Ozcan, from the Department of Electrical Engineering at the University of California, Los Angeles are conducting a research study. You were selected as a possible participant in this study because you are a current medical resident in an ACGME-I-accredited residency programs in pathology. Your participation in this research study is voluntary.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "WHAT SHOULD I KNOW ABOUT A RESEARCH STUDY?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "• Someone will explain this research study to you.");
            let _ = writeln!(stdin, "• Whether or not you take part is up to you.");
            let _ = writeln!(stdin, "• You can choose not to take part.");
            let _ = writeln!(stdin, "• You can agree to take part and later change your mind.");
            let _ = writeln!(stdin, "• Your decision will not be held against you.");
            let _ = writeln!(stdin, "• You can ask all the questions you want before you decide.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "WHY IS THIS RESEARCH BEING DONE?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "You are being invited to participate in a research study that evaluates the effectiveness of the BioGames platform in training pathology residents to accurately score clinical datasets, specifically Her2-stained breast tissue biopsies. The study aims to assess whether the BioGames platform can improve diagnostic accuracy and speed by using an interactive, competitive gaming environment.<");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "HOW LONG WILL THE RESEARCH LAST AND WHAT WILL I NEED TO DO?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "We estimate participation will take on an average of 30 minutes in total within the timeframe a month. Participant is expected to complete Pre-test, Post-test and at least one practice session. Pre-test and Post-test will each take around 5 minutes. Each practice session on the platform is expected to last 2 – 5 minutes and participants are encouraged to engage with the game multiple times to improve their scores.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "If you volunteer to participate in this study, the researcher will ask you to do the following:");
            let _ = writeln!(stdin, "1. Complete an initial pre-test to evaluate your current ability to score Her2-stained breast tissue biopsies.");
            let _ = writeln!(stdin, "2. Use the BioGames platform for two weeks during which you will have unlimited access to the platform to practice and compete with other participants in scoring biopsies.");
            let _ = writeln!(stdin, "3. At the end of the study period, you will complete a post-test to assess any improvements in your diagnostic skills.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "HOW MANY PEOPLE ARE EXPECTED TO PARTICIPATE");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "The study aims to recruit a maximum of 20 participants at UCLA in the trial phase, and 2500 participants nationally across medical residency programs in the national phase.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "ARE THERE ANY RISKS IF I PARTICIPATE?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "There are no known risks or discomforts associated with participation in this study. However, if you feel any discomfort while using the platform, you may stop at any time.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "ARE THERE ANY BENEFITS IF I PARTICIPATE?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "We cannot promise any benefits to others from your taking part in this research. However, the study may benefit others by enhancing their diagnostic skill and accurately score Her2-stained breast tissue biopsies in the future.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "What other choices do I have if I choose not to participate?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Your participation in this study is entirely voluntary. You may refuse to participate or withdraw from the study at any time without penalty or loss of benefits to which you are otherwise entitled. If you choose to withdraw, your data will be discarded.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "HOW WILL INFORMATION ABOUT ME AND MY PARTICIPATION BE KEPT CONFIDENTIAL?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "The researchers will do their best to make sure that your private information is kept confidential. Information about you will be handled as confidentially as possible, but participating in research may involve a loss of privacy and the potential for a breach in confidentiality. Study data will be physically and electronically secured.  As with any use of electronic means to store data, there is a risk of breach of data security.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Use of personal information that can identify you:");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "You will receive an unique access code from the study coordinator at your program. No personal identifying information will be collected.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "How information about you will be stored:");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "All study material will be stored in an encrypted drive that will be accessible only to a very small number of authorized people involved in this project. The research team will carefully follow the coding, storage, and data sharing plan explained below. No identifiable information about you will be kept with the research data. All research data and records will be stored on a laptop computer that is securely encrypted.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "People and agencies that will have access to your information:");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "The research team and authorized UCLA personnel may have access to study data and records to monitor the study.  Research records provided to authorized, non-UCLA personnel will not contain identifiable information about you. Publications and/or presentations that result from this study will not identify you by name.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Employees of the University may have access to identifiable information as part of routine processing of your information, such as lab work or processing payment. However, University employees are bound by strict rules of confidentiality.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "How long information from the study will be kept:");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Data collected from participants will be kept for a minimum of 3 years after the completion of the study or the last published result, whichever is later, in accordance with federal regulations and institutional policies. This is to ensure that the data is available for any audits, reviews, or further analysis. Your data, including de-identified data may be kept for use in future research, including research that is not currently known. If you do not want your data to be used for future research, you should not participate in this study.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "USE OF DATA FOR FUTURE RESEARCH");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Your data, including de-identified data may be kept for use in future research.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "WILL I BE PAID FOR MY PARTICIPATION?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "Participants who rank in the top 10 nationally for diagnostic accuracy and time will be eligible to receive a gift card valued at under $100 as a reward for their efforts.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "WHO CAN I CONTACT IF I HAVE QUESTIONS ABOUT THIS STUDY?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "The research team:");
            let _ = writeln!(stdin, "If you have any questions, comments or concerns about the research, you can talk to the one of the researchers, please contact Brian Qinyu Cheng, bqcheng@mednet.ucla.edu. If you have any questions, comments or concerns about the study team, you can talk to the faculty sponsor, please contact Dr. Aydogan Ozcan, ozcan@ee.ucla.edu. If you would like to reach us by phone, please call Dr. Aydogan Ozcan office phone at (310) 825-0915.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "UCLA Office of the Human Research Protection Program (OHRPP):");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "If you have questions about your rights as a research subject, or you have concerns or suggestions and you want to talk to someone other than the researchers, you may contact the UCLA OHRPP by phone: (310) 206-2040; by email: participants@research.ucla.edu or by mail: Box 951406, Los Angeles, CA 90095-1406.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "WHAT ARE MY RIGHTS IF I TAKE PART IN THIS STUDY?");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "• You can choose whether or not you want to be in this study, and you may withdraw your consent and discontinue participation at any time.");
            let _ = writeln!(stdin, "• Whatever decision you make, there will be no penalty to you, and no loss of benefits to which you were otherwise entitled.");
            let _ = writeln!(stdin, "• You may refuse to answer any questions that you do not want to answer and still remain in the study.");
            let _ = writeln!(stdin, "");
            let _ = writeln!(stdin, "You will be given a copy of this information to keep for your records.");
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