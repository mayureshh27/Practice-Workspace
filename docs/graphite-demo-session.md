# Graphite Demo Terminal Session

This document preserves the terminal session from the Graphite (`gt`) tutorial/demo completed on 2026-05-31, illustrating how stacked branches work in this codebase.

## Terminal Output

```bash
# Building on existing PRs (Step 5 of 5)

So far, you have implemented search for tasks successfully. But you want to be
able to search users simultaneously. Stacking allows you to build this
on top of the changes you already have!

Please run gt top to move to the top branch in this stack:

Practice-tool 05-31-demo_418795c9_add_server_api
❯ gt top

05-31-demo_418795c9_add_server_api
Checked out 05-31-demo_ca73f179_add_frontend_for_search.

Great, now you're on the top branch. Your next task is to add search
for users onto this!

Please run git diff to view the changes we just generated:

Practice-tool 05-31-demo_ca73f179_add_frontend_for_search
❯ git diff

warning: in the working copy of 'graphite-demo/frontend.jsx', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'graphite-demo/server.js', LF will be replaced by CRLF the next time Git touches it
diff --git a/graphite-demo/frontend.jsx b/graphite-demo/frontend.jsx
index dd6a2a3..10512ee 100644
--- a/graphite-demo/frontend.jsx
+++ b/graphite-demo/frontend.jsx
@@ -1,7 +1,8 @@
 import React, { useEffect, useState } from 'react';

-const TaskSearch = () => {
+const TaskAndUserSearch = () => {
   const [tasks, setTasks] = useState([]);
+  const [users, setUsers] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);
   const [searchQuery, setSearchQuery] = useState('');
@@ -16,14 +17,15 @@ const TaskSearch = () => {
         return response.json();
       })
       .then(data => {
-        setTasks(data);
+        setTasks(data.tasks);
+        setUsers(data.users);
         setLoading(false);
       })
       .catch(error => {
         setError(error.message);
         setLoading(false);
       });
-  }, [searchQuery]); // Depend on searchQuery
+  }, [searchQuery]);

   if (loading) {
     return <div>Loading...</div>;
@@ -35,13 +37,14 @@ const TaskSearch = () => {

   return (
     <div>
-      <h2>Task Search</h2>
+      <h2>Search Tasks and Users</h2>
       <input
         type="text"
-        placeholder="Search tasks..."
+        placeholder="Search tasks and users..."
         value={searchQuery}
         onChange={(e) => setSearchQuery(e.target.value)}
       />
+      <h3>Tasks</h3>
       <ul>
         {tasks.map(task => (
           <li key={task.id}>
@@ -49,8 +52,16 @@ const TaskSearch = () => {
           </li>
         ))}
       </ul>
+      <h3>Users</h3>
+      <ul>
+        {users.map(user => (
+          <li key={user.id}>
+            <p>{user.name}</p>
+          </li>
+        ))}
+      </ul>
     </div>
   );
 };

-export default TaskSearch;
\ No newline at end of file
+export default TaskAndUserSearch;
\ No newline at end of file
diff --git a/graphite-demo/server.js b/graphite-demo/server.js
index cf7ec65..ff79b7d 100644
--- a/graphite-demo/server.js
+++ b/graphite-demo/server.js
@@ -18,17 +18,38] const tasks = [
   }
 ];

+// Fake data for users
+const users = [
+  {
+    id: 101,
+    name: 'Alice Smith'
+  },
+  {
+    id: 102,
+    name: 'Bob Johnson'
+  },
+  {
+    id: 103,
+    name: 'Charlie Brown'
+  }
+];
+
 app.get('/search', (req, res) => {
   // Retrieve the query parameter
   const query = req.query.query?.toLowerCase() || '';

   // Filter tasks based on the query
-  const filteredTasks = tasks.filter(task => task.description.toLowerCase().includes(query));
+  const filteredTasks = tasks.filter(task =>
+    task.description.toLowerCase().includes(query)
+  ).sort((a, b) => a.description.localeCompare(b.description));

-  // Sort the filtered tasks alphabetically by description
-  const sortedTasks = filteredTasks.sort((a, b) => a.description.localeCompare(b.description));
+  // Filter users based on the query
+  const filteredUsers = users.filter(user =>
+    user.name.toLowerCase().includes(query)
+  ).sort((a, b) => a.name.localeCompare(b.name));

-  res.json(sortedTasks);
+  // Return both sets of results
+  res.json({ tasks: filteredTasks, users: filteredUsers });
 });

 app.listen(port, () => {

Now, you can create a new branch that just adds actor search onto the
existing changes.

Please run gt create --all --message "Add user search" to create a new branch with these changes:

Practice-tool 05-31-demo_ca73f179_add_frontend_for_search
❯ gt create --all --message "Add user search"

2 files changed, 42 insertions(+), 10 deletions(-)

This is the same as running git add -A && gt create --message, just in
a single command.

You have successfully added user search onto the server API!
Use gt log --stack to view your entire stack:

Practice-tool 05-31-demo_5ac69286_add_user_search
❯ gt log --stack

◉ 05-31-demo_5ac69286_add_user_search (current)
│ 8 seconds ago
│
│ 99eb650 - Add user search
│
◯ 05-31-demo_ca73f179_add_frontend_for_search
│ 86 seconds ago
│
│ PR #3 (Draft) Add frontend for search
│ https://app.graphite.com/github/pr/mayureshh27/Practice-tool/3
│ Last submitted version: v2
│
│ 2efee20 - Add frontend for search
│
◯ 05-31-demo_418795c9_add_server_api
│ 86 seconds ago
│
│ PR #2 (Draft) Add server API
│ https://app.graphite.com/github/pr/mayureshh27/Practice-tool/2
│ Last submitted version: v2
│
│ 6639df1 - Add server API
│
◯ main
│ 14 minutes ago
│
│ 2f23b4a - improved codebased architectures / nuclear code review / more features implemented
│

Finally, run gt submit --stack to submit the newest change:

Practice-tool 05-31-demo_5ac69286_add_user_search
❯ gt submit --stack

🥞 Validating that this Graphite stack is ready to submit...

📝 Preparing to submit PRs for the following branches...
▸ 05-31-demo_418795c9_add_server_api (No-op)
▸ 05-31-demo_ca73f179_add_frontend_for_search (No-op)
▸ 05-31-demo_5ac69286_add_user_search (Create)

🚀 Pushing branches to remote...
Running git push: [========================================] 100% | Done

📨 Creating/updating PRs...
05-31-demo_5ac69286_add_user_search: created
https://app.graphite.com/github/pr/mayureshh27/Practice-tool/4

🎉 You have successfully created, modified, and submitted a stack!
You are ready to get started with Graphite.

TIP: You may use gt delete to delete the branches you just created.


PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (05-31-demo_5ac69286_add_user_search)
$ gt delete
√ Are you sure you want to delete 05-31-demo_5ac69286_add_user_search, which is neither merged nor closed? (Skip with `--force`) ... no

PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (05-31-demo_5ac69286_add_user_search)
$ gt delete
√ Are you sure you want to delete 05-31-demo_5ac69286_add_user_search, which is neither merged nor closed? (Skip with `--force`) ... yes
Deleted branch 05-31-demo_5ac69286_add_user_search (previously at 99eb650a83852e6f3d152d48319fb7244152d87d)

PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (05-31-demo_ca73f179_add_frontend_for_search)
$ 

PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (05-31-demo_ca73f179_add_frontend_for_search)
$ gt delete
√ Are you sure you want to delete 05-31-demo_ca73f179_add_frontend_for_search, which is neither merged nor closed? (Skip with `--force`) ... yes
Deleted branch 05-31-demo_ca73f179_add_frontend_for_search (previously at 2efee20771243b704bb313107a2097d2361862e2)

PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (05-31-demo_418795c9_add_server_api)
$

PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (05-31-demo_418795c9_add_server_api)
$ gt delete
√ Are you sure you want to delete 05-31-demo_418795c9_add_server_api, which is neither merged nor closed? (Skip with `--force`) ... yes
Deleted branch 05-31-demo_418795c9_add_server_api (previously at 6639df103919011d64d3f0386db852eaa4df9741)

PREDATOR@Mayuresh-PC MINGW64 /d/Robotics/Learning-Platform/Practice-tool (main)
$
```
