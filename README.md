# Nerses Sinanian: website

A one-page site for an independent life insurance agent. It's a single file, `index.html`, with no server and nothing to install. The contact form sends through Formspree, which emails each inquiry to Nerses. The site is hosted on Netlify.

## 1. Fill in his real details

Open `index.html` in VS Code and search for `class="ph"`. Each yellow placeholder needs his real info. After you replace one, delete the `ph` class so the yellow highlight goes away.

- Anything still highlighted yellow (search for `class="ph"`). Phone, email and California are already filled in; add hours or a city if he wants them
- Coverage types: edit the four cards to match what he actually sells
- Footer: his state, and his license number if his state requires it on advertising

To preview, double-click `index.html` in Finder. The form won't send until step 2 is done.

## 2. Set up the contact form (Formspree)

1. Make a free account at https://formspree.io.
2. Create a new form and give it the email address where Nerses wants inquiries.
3. Formspree shows a form link like `https://formspree.io/f/abcdwxyz`. Copy it.
4. In `index.html`, search for `FORM_ENDPOINT` and replace `https://formspree.io/f/YOUR_FORM_ID` with your link. Keep the quotation marks.
5. Save, then send a test inquiry once the site is live and check that the email arrives.

Until the link is replaced, the form tells visitors it isn't connected yet, so nothing is lost silently.

The free Formspree plan has a monthly limit on submissions. Check https://formspree.io/plans for the current number.

## 3. Put it on GitHub

In VS Code: Source Control (the branching icon), Initialize Repository, type a message, Commit, then Publish Branch and choose a private repository.

## 4. Put it online (Netlify)

1. Make a free account at https://netlify.com (sign in with GitHub).
2. Add new site, then Import an existing project, and pick the repository.
3. Leave the build command empty and the publish directory as `.` (the included `netlify.toml` already sets this). Click Deploy.
4. In the site's Domain settings, connect his domain once he has one. HTTPS is set up automatically.

Each time you commit and sync changes in VS Code, Netlify updates the live site automatically.

## Notes

- The form has a hidden spam trap field. Formspree also filters spam.
- The estimator runs in the visitor's browser only. Nothing from it is sent or saved.
- Visitors' contact details pass through Formspree to Nerses's email. Don't ask for Social Security numbers, bank details or health information through the form.
- Check with APIM and the carriers before using their names or logos, and have Nerses confirm that the wording and the footer disclaimer meet his state's rules for insurance advertising.
