use std::process::Command;
use serde_json::json;

pub async fn generate_psychology_profile(workspace_dir: &str, model: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["log", "-n", "30", "--patch"])
        .current_dir(workspace_dir)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;
    
    let git_log = String::from_utf8_lossy(&output.stdout).to_string();
    if git_log.trim().is_empty() {
        return Err("No git history found or not a git repository.".into());
    }

    let mut log_snippet = git_log;
    if log_snippet.len() > 15000 {
        log_snippet.truncate(15000);
        log_snippet.push_str("\n...[truncated]");
    }

    let prompt = format!(
        "You are the Git-Psychology Engine. Analyze the following recent git history of this project.\nIdentify the authors' coding styles, variable naming habits, framework preferences, and architectural quirks.\Write a concise, 5-bullet-point 'Psychology Profile' that can be injected into an AI's system prompt so that the AI perfectly mimics the original human authors. Do not include any fluff.\n\nGIT HISTORY:\n{}", log_snippet
    );

    let client = reqwest::Client::new();
    let body = json!({
        "model": model,
        "prompt": prompt,
        "stream": false
    });

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json_res: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let profile = json_res["response"].as_str().unwrap_or("Failed to generate profile.").to_string();

    Ok(profile)
}
