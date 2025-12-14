Current to-do (besides main steps)
1. Implement the rest of the comment routing
2. Remember to remove security vulnerabilities in lockout
3. Make sure email format is validated on update
4. Make sure lockout expires correctly
5. Security flaw: the /me route used by the login success page stores sensitive info in the url
6. Remember to change success pages in the change Routes
7. Add display name limitations?
8. When doing comments section make sure it generates page based off id -> display_name && displays username color
9. Step 6 Checklist: Fix all errors codes and redirects on success, add public profile support, make it look better.
. Remember the rest of the list

To run server:
1. Run "git clone https://github.com/Xyrox47/498Midterm-Wild-West-Forum.git"
2. Enter my-nodejs-app folder in /498Midterm-Wild-West-Forum/my-nodejs-app/
3. Run "docker compose -f docker-compose.yml up --build -d" To build and compose the server while detached
4. Server is now running at "157.245.5.56:1555"
