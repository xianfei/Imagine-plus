use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::{Map, Value};

/// Tiny JSON-file config store replacing electron-store.
/// Keys in use: keepmeta, progressive, checkupdate.
pub struct ConfigStore {
    path: PathBuf,
    data: Mutex<Map<String, Value>>,
}

impl ConfigStore {
    pub fn load(config_dir: PathBuf) -> Self {
        let path = config_dir.join("config.json");
        let data = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Map<String, Value>>(&bytes).ok())
            .unwrap_or_default();

        Self {
            path,
            data: Mutex::new(data),
        }
    }

    pub fn get_all(&self) -> Value {
        Value::Object(self.data.lock().unwrap().clone())
    }

    pub fn get_bool(&self, key: &str, default: bool) -> bool {
        self.data
            .lock()
            .unwrap()
            .get(key)
            .and_then(Value::as_bool)
            .unwrap_or(default)
    }

    pub fn set(&self, key: String, value: Value) {
        let mut data = self.data.lock().unwrap();
        data.insert(key, value);

        if let Some(parent) = self.path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(bytes) = serde_json::to_vec_pretty(&*data) {
            if let Err(err) = fs::write(&self.path, bytes) {
                log::error!("failed to persist config: {err}");
            }
        }
    }
}
