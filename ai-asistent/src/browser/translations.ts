export type Language = 'en' | 'bs';

export interface Translations {
    // Main UI
    greeting: string;
    question: string;
    compileError: string;
    wrongOutput: string;
    crashing: string;
    testsFailing: string;

    // Actions
    back: string;
    cancel: string;
    submit: string;
    next: string;
    processing: string;
    proceedAnyway: string;

    // Errors
    error: string;
    noFileOpen: string;
    noFilePath: string;
    noGccOut: string;
    noAsanOut: string;
    aiResponse: string;
    aiProfessorResponse: string;
    feedbackProcessing: string;

    // Forms
    userInputLabel: string;
    userInputPlaceholder: string;
    programOutputLabel: string;
    programOutputPlaceholder: string;
    expectedOutputLabel: string;
    expectedOutputPlaceholder: string;

    // Step-by-step forms (output wrong workflow)
    step1Title: string;
    step1InputPrompt: string;
    step1InputPlaceholder: string;
    step1OutputPrompt: string;
    step1OutputPlaceholder: string;
    step2Title: string;
    step2Prompt: string;
    step2Placeholder: string;
    continue: string;
    getHelp: string;

    // Test results
    testOutput: string;
    testsPassed: string;
    testsFailed: string;
    testsTotal: string;
    testsNotFound: string;
    testResultsNotFound: string;
    mainNotFound: string;
    noFailedTests: string;
    apiError: string;

    // Quota exceeded
    quotaTitle: string;
    quotaMessage: string;

    // Crash warning
    crashWarningTitle: string;
    crashWarningMessage: string;

    // User feedback
    feedbackQuestion: string;
    feedbackHelpful: string;
    feedbackNotHelpful: string;
    feedbackConfusing: string;
    feedbackThankYou: string;

    // Validation warnings
    emptyExpectedTitle: string;
    emptyExpectedMessage: string;
    outputsEqualTitle: string;
    outputsEqualMessage: string;
    whitespaceWarningTitle: string;
    whitespaceWarningMessage: string;
    emptyGccTitle: string;
    emptyGccMessage: string;
    compileWarnTitle: string;
    compileWarnMessage: string;
    staleGccTitle: string;
    staleGccMessage: string;
    staleAsanTitle: string;
    staleAsanMessage: string;

    // Response type selector (V2 backend)
    responseTypeTitle: string;
    responseTypeQuestion: string;
    responseTypeHint: string;
    responseTypeHintDesc: string;
    responseTypeBook: string;
    responseTypeBookDesc: string;
    responseTypePractice: string;
    responseTypePracticeDesc: string;
}

export const translations: Record<Language, Translations> = {
    en: {
        greeting: "Hello, I'm your AI teaching assistant!",
        question: "What can I help you with?",
        compileError: "Code doesn't compile",
        wrongOutput: "Program output is wrong",
        crashing: "Program is crashing",
        testsFailing: "Tests are failing",

        back: "Back",
        cancel: "Cancel",
        submit: "Submit",
        next: "Next",
        processing: "Processing your request...",
        proceedAnyway: "Proceed Anyway",

        error: "Error",
        noFileOpen: "No file is currently open in the editor.",
        noFilePath: "Could not determine the file path.",
        noGccOut: "Could not find compilation errors. Try running your program to generate errors.",
        noAsanOut: "Could not find crash report. Try running your program with inputs that cause it to crash.",
        aiResponse: "AI Assistant Response",
        aiProfessorResponse: "AI Professor Response",
        feedbackProcessing: "Your feedback is being reviewed by AI professor. Please wait...",

        userInputLabel: "What input did you provide to your program?",
        userInputPlaceholder: "Enter the input you gave to your program...",
        programOutputLabel: "What did your program output?",
        programOutputPlaceholder: "Enter what your program printed...",
        expectedOutputLabel: "What should your program have output?",
        expectedOutputPlaceholder: "Enter what the correct output should be...",

        // Step-by-step forms
        step1Title: "Step 1: Input and Output",
        step1InputPrompt: "Enter the input values your program received (or leave empty if none):",
        step1InputPlaceholder: "Example: 5 3",
        step1OutputPrompt: "Copy and paste your program's output here:",
        step1OutputPlaceholder: "Example: 7 (copy from terminal, NOT code!)",
        step2Title: "Step 2: Expected Output",
        step2Prompt: "Enter or paste the expected output for your program:",
        step2Placeholder: "Example: 8",
        continue: "Continue",
        getHelp: "Get AI Help",

        testOutput: "Test Output",
        testsPassed: "Tests passed",
        testsFailed: "Tests failed",
        testsTotal: "Total tests",
        testsNotFound: "Could not find test results file.",
        testResultsNotFound: "Test results not found or could not be parsed.",
        mainNotFound: "Test harness could not find main function. Please check if non-standard main declaration is used.",
        noFailedTests: "All tests passed - no need for help!",
        apiError: "API response did not contain expected data.",

        quotaTitle: "Daily AI Request Quota Exceeded",
        quotaMessage: "You have reached your daily limit for AI assistant requests. You will be able to ask your next question tomorrow or next week, according to the rules set by your course teacher.",

        crashWarningTitle: "⚠️ WARNING",
        crashWarningMessage: "I can't find the file which is usually created when a program crashes. Are you sure that your program is crashing? If not, click on Cancel and choose another option for help. Otherwise try running your program again and enter the values that cause it to crash. After clicking Cancel you should not see this warning again. Otherwise I can try and guess why it is crashing - but I could be wrong!",

        feedbackQuestion: "Did AI assistant help you solve your problem?",
        feedbackHelpful: "Yes, I know what to fix now",
        feedbackNotHelpful: "No, this doesn't match my problem",
        feedbackConfusing: "I don't understand the explanation",
        feedbackThankYou: "Thank you for your feedback!",

        emptyExpectedTitle: "⚠️ Expected Output is Empty",
        emptyExpectedMessage: "Expected output cannot be empty. Please enter what your program should print.",
        outputsEqualTitle: "⚠️ Outputs are Identical",
        outputsEqualMessage: "Actual and expected output are identical. If the outputs are the same, your program is correct and doesn't need AI assistant help.",
        whitespaceWarningTitle: "⚠️ WARNING - Difference Only in Whitespace",
        whitespaceWarningMessage: "Actual and expected output differ only in spaces or newlines. AI assistant is not very accurate with this type of problem because it cannot see exact spacing in text. I recommend manually comparing outputs using 'diff' tool or carefully reviewing terminal output.",
        emptyGccTitle: "⚠️ No Compilation Errors",
        emptyGccMessage: "I can't find the compilation error file or it's empty. Try running your program again to record compilation errors.",
        compileWarnTitle: "⚠️ WARNING - Compiler Warnings Only",
        compileWarnMessage: "Compiler did not report any errors, only warnings. AI assistant can try to explain warnings, but they may not be the cause of your problem. Consider choosing another option if you have a different issue.",
        staleGccTitle: "⚠️ WARNING - Stale Compilation Errors",
        staleGccMessage: "Source code has been modified after last compilation. Compilation errors may no longer be accurate. I recommend running your program again to update the errors.",
        staleAsanTitle: "⚠️ WARNING - Stale Crash Report",
        staleAsanMessage: "Source code has been modified after the last program crash. Crash report may no longer be accurate. I recommend running your program again to update the report.",

        responseTypeTitle: "How would you like to be helped?",
        responseTypeQuestion: "Choose the kind of assistance you'd like:",
        responseTypeHint: "Give me a hint",
        responseTypeHintDesc: "A short nudge in the right direction, without giving away the solution",
        responseTypeBook: "Relevant book chapters",
        responseTypeBookDesc: "Point me to the textbook sections that cover this",
        responseTypePractice: "Worked examples",
        responseTypePracticeDesc: "Show me similar solved assignments",
    },
    bs: {
        greeting: "Zdravo, ja sam vaš AI asistent za nastavu!",
        question: "Čime vam mogu pomoći?",
        compileError: "Kod se ne kompajlira",
        wrongOutput: "Izlaz programa je pogrešan",
        crashing: "Program se krahira",
        testsFailing: "Testovi ne prolaze",

        back: "Nazad",
        cancel: "Otkaži",
        submit: "Pošalji",
        next: "Dalje",
        processing: "Obrađujem vaš zahtjev...",
        proceedAnyway: "Nastavi svejedno",

        error: "Greška",
        noFileOpen: "Nema otvorenog fajla u editoru.",
        noFilePath: "Ne mogu odrediti putanju fajla.",
        noGccOut: "Ne mogu pronaći greške kompajliranja. Pokušajte pokrenuti program da bi se greške generisale.",
        noAsanOut: "Ne mogu pronaći izvještaj o krahiranju. Pokušajte pokrenuti program sa ulazima koji uzrokuju krahiranje.",
        aiResponse: "Odgovor AI asistenta",
        aiProfessorResponse: "Odgovor AI profesora",
        feedbackProcessing: "AI profesor analizira Vaš feedback. Molimo sačekajte...",

        userInputLabel: "Koji ulaz ste dali vašem programu?",
        userInputPlaceholder: "Unesite ulaz koji ste dali programu...",
        programOutputLabel: "Šta je vaš program ispisao?",
        programOutputPlaceholder: "Unesite šta je vaš program ispisao...",
        expectedOutputLabel: "Šta bi vaš program trebao ispisati?",
        expectedOutputPlaceholder: "Unesite kakav bi tačan izlaz trebao biti...",

        step1Title: "Korak 1: Ulaz i izlaz",
        step1InputPrompt: "Unesite ulazne vrijednosti koje je vaš program primio (ili ostavite prazno ako nema ulaza):",
        step1InputPlaceholder: "Primjer: 5 3",
        step1OutputPrompt: "Kopirajte i nalijepite izlaz vašeg programa ovdje:",
        step1OutputPlaceholder: "Primjer: 7 (kopirajte iz terminala, NE iz koda!)",
        step2Title: "Korak 2: Očekivani izlaz",
        step2Prompt: "Unesite ili nalijepite očekivani izlaz za vaš program:",
        step2Placeholder: "Primjer: 8",
        continue: "Nastavi",
        getHelp: "Zatraži pomoć AI asistenta",

        testOutput: "Izlaz testova",
        testsPassed: "Testovi uspješni",
        testsFailed: "Testovi neuspješni",
        testsTotal: "Ukupno testova",
        testsNotFound: "Ne mogu pronaći fajl sa rezultatima testova.",
        testResultsNotFound: "Rezultati testova nisu pronađeni ili se ne mogu parsirati.",
        mainNotFound: "Funkcija za testiranje nije mogla pronaći main funkciju. Molimo provjerite da li je korištena nestandardna deklaracija main-a.",
        noFailedTests: "Svi testovi su uspješni - nema potrebe za pomoć!",
        apiError: "API odgovor ne sadrži očekivane podatke.",

        quotaTitle: "Dnevna kvota AI zahtjeva je prekoračena",
        quotaMessage: "Dostigli ste dnevni limit za AI asistent zahtjeve. Moći ćete postaviti sljedeće pitanje sutra ili sljedeće sedmice, u zavisnosti od pravila koja je postavio vaš predmetni nastavnik.",

        crashWarningTitle: "⚠️ UPOZORENJE",
        crashWarningMessage: "Ne mogu pronaći fajl koji se obično kreira kada se program krahira. Jeste li sigurni da se vaš program krahirao? Ako niste, kliknite na Otkaži i odaberite drugu opciju za pomoć. U suprotnom pokušajte ponovo pokrenuti program i unesite vrijednosti koje uzrokuju krahiranje. Nakon klika na Otkaži ne biste trebali vidjeti ovo upozorenje ponovo. U suprotnom mogu pokušati pogoditi zašto se krahira - ali bih mogao pogriješiti!",

        feedbackQuestion: "Da li vam je AI asistent pomogao da riješite problem?",
        feedbackHelpful: "Da, sada znam šta trebam ispraviti",
        feedbackNotHelpful: "Ne, ovo se ne odnosi na moj problem",
        feedbackConfusing: "Ne razumijem objašnjenje",
        feedbackThankYou: "Hvala vam na povratnoj informaciji!",

        emptyExpectedTitle: "⚠️ Očekivani izlaz je prazan",
        emptyExpectedMessage: "Očekivani izlaz ne može biti prazan. Molimo unesite šta bi program trebao ispisati.",
        outputsEqualTitle: "⚠️ Izlazi su identični",
        outputsEqualMessage: "Stvarni i očekivani izlaz su identični. Ako su izlazi isti, program je ispravan i ne treba pomoć AI asistenta.",
        whitespaceWarningTitle: "⚠️ UPOZORENJE - Razlika samo u razmacima",
        whitespaceWarningMessage: "Stvarni i očekivani izlaz se razlikuju samo u razmacima ili novim redovima. AI asistent nije veoma precizan sa ovim tipom problema jer ne vidi tačno razmake u tekstu. Preporučujem da ručno uporedite izlaze koristeći 'diff' alat ili pažljivo pregledajući terminal izlaz.",
        emptyGccTitle: "⚠️ Nema grešaka kompajliranja",
        emptyGccMessage: "Ne mogu pronaći fajl sa greškama kompajliranja ili je prazan. Pokušajte ponovo pokrenuti program da bi se greške kompajliranja zapisale.",
        compileWarnTitle: "⚠️ UPOZORENJE - Samo upozorenja kompajlera",
        compileWarnMessage: "Kompajler nije prijavio nikakve greške, samo upozorenja. Na str. 26 knjige \"Uvod u programiranje - C i C++\" objašnjena je razlika između greške i upozorenja. AI asistent može pokušati objasniti upozorenja, ali imajte na umu da upozorenje može značiti grešku ali i ne mora, upozorenja skreću pažnju programera na potencijalni problem.",
        staleGccTitle: "⚠️ UPOZORENJE - Zastarjele greške kompajliranja",
        staleGccMessage: "Izvorni kod je promijenjen nakon posljednjeg kompajliranja. Greške kompajliranja možda više nisu tačne. Preporučujem da ponovo pokrenete program da bi se greške kompajliranja ažurirale.",
        staleAsanTitle: "⚠️ UPOZORENJE - Zastarjeli izvještaj o krahiranju",
        staleAsanMessage: "Izvorni kod je promijenjen nakon posljednjeg krahiranja programa. Izvještaj o krahiranju možda više nije tačan. Preporučujem da ponovo pokrenete program (Run) da bi se izvještaj ažurirao.",

        responseTypeTitle: "Kako želite da vam pomognem?",
        responseTypeQuestion: "Odaberite vrstu pomoći koju želite:",
        responseTypeHint: "Daj mi savjet",
        responseTypeHintDesc: "Kratka smjernica u pravom smjeru, bez otkrivanja rješenja",
        responseTypeBook: "Relevantna poglavlja iz knjige",
        responseTypeBookDesc: "Uputi me na dijelove udžbenika koji pokrivaju ovu temu",
        responseTypePractice: "Riješeni primjeri",
        responseTypePracticeDesc: "Pokaži mi slične riješene zadatke",
    }
};

export function t(language: Language, key: keyof Translations): string {
    return translations[language][key] || key;
}
