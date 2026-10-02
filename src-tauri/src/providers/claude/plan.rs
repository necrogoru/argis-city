//! Todo/plan tracking from `TodoWrite` and the `TaskCreate`/`TaskUpdate` stream.

use crate::domain::PlanCounts;
use serde_json::Value;

#[derive(Debug, Default, Clone)]
pub struct PlanTracker {
    /// (id, status) in creation order.
    items: Vec<(String, String)>,
    next_task_id: u32,
    seen: bool,
}

impl PlanTracker {
    pub fn on_tool_use(&mut self, name: &str, input: &Value) {
        match name {
            "TodoWrite" => self.replace_todos(input),
            "TaskCreate" => {
                self.next_task_id += 1;
                self.items.push((self.next_task_id.to_string(), "pending".into()));
                self.seen = true;
            }
            "TaskUpdate" => self.update_task(input),
            _ => {}
        }
    }

    /// `None` until a plan tool has been used at all.
    pub fn counts(&self) -> Option<PlanCounts> {
        self.seen.then(|| PlanCounts::from_statuses(self.items.iter().map(|(_, s)| s.as_str())))
    }

    fn replace_todos(&mut self, input: &Value) {
        let Some(todos) = input.get("todos").and_then(Value::as_array) else { return };
        self.items = todos
            .iter()
            .enumerate()
            .map(|(i, t)| (i.to_string(), t["status"].as_str().unwrap_or("pending").to_string()))
            .collect();
        self.seen = true;
    }

    fn update_task(&mut self, input: &Value) {
        let id = match &input["taskId"] {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            _ => return,
        };
        let Some(status) = input["status"].as_str() else { return };
        if status == "deleted" {
            self.items.retain(|(i, _)| *i != id);
        } else if let Some(item) = self.items.iter_mut().find(|(i, _)| *i == id) {
            item.1 = status.to_string();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn todo_write_replaces_the_list() {
        let mut p = PlanTracker::default();
        assert_eq!(p.counts(), None);
        p.on_tool_use("TodoWrite", &json!({"todos": [{"status": "completed"}, {"status": "pending"}]}));
        p.on_tool_use(
            "TodoWrite",
            &json!({"todos": [{"status": "completed"}, {"status": "completed"}, {"status": "in_progress"}]}),
        );
        assert_eq!(p.counts(), Some(PlanCounts { completed: 2, total: 3 }));
    }

    #[test]
    fn task_stream_creates_updates_and_deletes() {
        let mut p = PlanTracker::default();
        for _ in 0..3 {
            p.on_tool_use("TaskCreate", &json!({"subject": "x"}));
        }
        p.on_tool_use("TaskUpdate", &json!({"taskId": "1", "status": "completed"}));
        p.on_tool_use("TaskUpdate", &json!({"taskId": 2, "status": "in_progress"}));
        p.on_tool_use("TaskUpdate", &json!({"taskId": "3", "status": "deleted"}));
        assert_eq!(p.counts(), Some(PlanCounts { completed: 1, total: 2 }));
    }
}
