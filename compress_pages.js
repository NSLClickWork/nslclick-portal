const fs = require('fs');

const enFile = 'views/marketing/employer.ejs';
const deFile = 'views/marketing/employer_de.ejs';

const newENContent = `    <!-- PAGE 2: The Decisive Advantage -->
    <div class="page grid-2" style="grid-template-columns: 1fr 1fr;">
        <div class="col-left" style="background: var(--nsl-light); color: var(--nsl-dark); display: flex; align-items: center; justify-content: center;">
            <div style="position: relative; width: 100%; padding: 20px;">
                <img src="/images/marketing/mockup2.png?v=8" class="screenshot" alt="Sharkie AI Search" style="width: 100%; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); border: 2px solid #eee;">
                
                <div style="position: absolute; bottom: -30px; right: -5px; background: var(--nsl-dark); color: white; padding: 20px 30px; border-radius: 50px 0 16px 0; box-shadow: 0 15px 30px rgba(0,0,0,0.3); border-left: 5px solid var(--nsl-gold); max-width: 320px; z-index: 10;">
                    <h4 style="margin: 0 0 10px 0; font-size: 18px; color: var(--nsl-gold);">Sharkie AI Assistant</h4>
                    <p style="font-size: 14px; margin: 0; color: #ccc;">"Show me nurses from Vietnam with B1 German ready to start in July."</p>
                </div>
            </div>
        </div>
        <div class="col-right">
            <h3 class="highlight-gold">OUR UNIQUE SELLING PROPOSITION</h3>
            <h2 style="font-size: 40px; line-height: 1.1; margin-bottom: 30px; text-transform: uppercase; color: var(--nsl-red);">The Decisive Advantage.</h2>
            
            <div class="feature-box" style="background: transparent; border-color: var(--nsl-red); padding-left: 0; border: none; border-left: 6px solid var(--nsl-red); padding-left: 20px;">
                <h4 style="font-size: 20px;">🤖 Sharkie AI Search</h4>
                <p style="font-size: 16px; line-height: 1.5;">Don't waste time clicking filters. Just talk to our AI in natural language to find exactly the candidates you need. Sharkie understands context, professions, and language requirements.</p>
            </div>

            <div class="feature-box" style="background: transparent; border-color: var(--nsl-gold); padding-left: 0; border: none; border-left: 6px solid var(--nsl-gold); padding-left: 20px; margin-top: 30px;">
                <h4 style="font-size: 20px;">🎯 The NSL-Score</h4>
                <p style="font-size: 16px; line-height: 1.5;">Every candidate undergoes a rigorous assessment evaluating IQ, decision making, and soft skills. The benchmark score of 48+ guarantees you're looking at the top percentile of global talent.</p>
            </div>
        </div>
    </div>

    <!-- PAGE 3: The Process & Booking -->
    <div class="page grid-2" style="grid-template-columns: 1fr 1fr;">
        <div class="col-left" style="background: white; color: var(--nsl-dark); padding: 40px; display: flex; flex-direction: column; justify-content: center;">
            <h3 class="highlight-gold">INSTANT BOOKING &amp; ONBOARDING</h3>
            <h2 style="font-size: 40px; line-height: 1.1; margin-bottom: 30px;">From Match to Hire.</h2>
            
            <div class="feature-box" style="background: transparent; border-color: var(--nsl-dark); padding-left: 0; border: none; border-left: 6px solid var(--nsl-dark); padding-left: 20px; margin-bottom: 20px;">
                <h4 style="font-size: 20px;">⚡ 3-Click Hiring Process</h4>
                <p style="font-size: 16px; line-height: 1.5;">Browse candidate Setcards, watch their 60-second introduction videos, and book onboarding sessions instantly with the <strong>Partnerschaft Anfragen</strong> button.</p>
            </div>
            
            <div class="feature-box" style="background: transparent; border-color: #2e7d32; padding-left: 0; border: none; border-left: 6px solid #2e7d32; padding-left: 20px; margin-bottom: 30px;">
                <h4 style="font-size: 20px;">🛡️ Full Relocation &amp; Visa Support</h4>
                <p style="font-size: 16px; line-height: 1.5;">Beyond matching, we handle all the heavy lifting: document translation, professional recognition, visa processing, and cultural integration.</p>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                <h4 style="margin: 0 0 5px 0;">Ready to start hiring?</h4>
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Ask your NSL account manager for your secure Access Code today.</p>
                <div style="background: var(--nsl-gold); color: var(--nsl-dark); padding: 12px 25px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 5px 15px rgba(255,193,7,0.3);">
                    Login: www.personalkampagne-portal.de
                </div>
            </div>
        </div>
        <div class="col-right" style="background: var(--nsl-red); display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden;">
            <div class="bg-pattern"></div>
            <img src="/images/marketing/setcard_modal.png" class="screenshot" alt="Setcard View" style="transform: perspective(1000px) rotateY(5deg) scale(1.05); border: 4px solid white; position: relative; z-index: 2;">
            <div style="background: white; padding: 15px 30px; border-radius: 50px; font-weight: 800; font-size: 18px; color: var(--nsl-red); box-shadow: 0 10px 20px rgba(0,0,0,0.2); position: relative; z-index: 3; transform: translateY(15px);">
                Comprehensive Setcards
            </div>
        </div>
    </div>
</body>
</html>`;

const newDEContent = `    <!-- PAGE 2: The Decisive Advantage -->
    <div class="page grid-2" style="grid-template-columns: 1fr 1fr;">
        <div class="col-left" style="background: var(--nsl-light); color: var(--nsl-dark); display: flex; align-items: center; justify-content: center;">
            <div style="position: relative; width: 100%; padding: 20px;">
                <img src="/images/marketing/mockup2.png?v=8" class="screenshot" alt="Sharkie AI Search" style="width: 100%; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); border: 2px solid #eee;">
                
                <div style="position: absolute; bottom: -30px; right: -5px; background: var(--nsl-dark); color: white; padding: 20px 30px; border-radius: 50px 0 16px 0; box-shadow: 0 15px 30px rgba(0,0,0,0.3); border-left: 5px solid var(--nsl-gold); max-width: 320px; z-index: 10;">
                    <h4 style="margin: 0 0 10px 0; font-size: 18px; color: var(--nsl-gold);">Sharkie KI-Assistent</h4>
                    <p style="font-size: 14px; margin: 0; color: #ccc;">"Zeige mir Pflegekräfte aus Vietnam mit B1 Deutsch, die im Juli anfangen können."</p>
                </div>
            </div>
        </div>
        <div class="col-right">
            <h3 class="highlight-gold">UNSER ALLEINSTELLUNGSMERKMAL</h3>
            <h2 style="font-size: 40px; line-height: 1.1; margin-bottom: 30px; text-transform: uppercase; color: var(--nsl-red);">Der entscheidende Vorteil.</h2>
            
            <div class="feature-box" style="background: transparent; border-color: var(--nsl-red); padding-left: 0; border: none; border-left: 6px solid var(--nsl-red); padding-left: 20px;">
                <h4 style="font-size: 20px;">🤖 Sharkie KI-Suche</h4>
                <p style="font-size: 16px; line-height: 1.5;">Verschwenden Sie keine Zeit mit Filtern. Sprechen Sie einfach in natürlicher Sprache mit unserer KI, um genau die Kandidaten zu finden, die Sie benötigen. Sharkie versteht Kontext, Berufe und Sprachanforderungen.</p>
            </div>

            <div class="feature-box" style="background: transparent; border-color: var(--nsl-gold); padding-left: 0; border: none; border-left: 6px solid var(--nsl-gold); padding-left: 20px; margin-top: 30px;">
                <h4 style="font-size: 20px;">🎯 Der NSL-Score</h4>
                <p style="font-size: 16px; line-height: 1.5;">Jeder Kandidat durchläuft ein strenges Assessment, das IQ, Entscheidungsfindung und Soft Skills bewertet. Der Richtwert von 48+ garantiert, dass Sie die besten internationalen Talente vor sich haben.</p>
            </div>
        </div>
    </div>

    <!-- PAGE 3: The Process & Booking -->
    <div class="page grid-2" style="grid-template-columns: 1fr 1fr;">
        <div class="col-left" style="background: white; color: var(--nsl-dark); padding: 40px; display: flex; flex-direction: column; justify-content: center;">
            <h3 class="highlight-gold">INSTANT BOOKING &amp; ONBOARDING</h3>
            <h2 style="font-size: 40px; line-height: 1.1; margin-bottom: 30px;">Vom Match zur Einstellung.</h2>
            
            <div class="feature-box" style="background: transparent; border-color: var(--nsl-dark); padding-left: 0; border: none; border-left: 6px solid var(--nsl-dark); padding-left: 20px; margin-bottom: 20px;">
                <h4 style="font-size: 20px;">⚡ 3-Klick Einstellungsprozess</h4>
                <p style="font-size: 16px; line-height: 1.5;">Durchsuchen Sie Kandidaten-Setcards, sehen Sie sich 60-sekündige Einführungsvideos an und buchen Sie Onboarding-Termine sofort über den <strong>Partnerschaft Anfragen</strong> Button.</p>
            </div>
            
            <div class="feature-box" style="background: transparent; border-color: #2e7d32; padding-left: 0; border: none; border-left: 6px solid #2e7d32; padding-left: 20px; margin-bottom: 30px;">
                <h4 style="font-size: 20px;">🛡️ Umfassende Relocation &amp; Visa-Unterstützung</h4>
                <p style="font-size: 16px; line-height: 1.5;">Über das Matching hinaus übernehmen wir die gesamte schwere Arbeit: Dokumentenübersetzung, Berufsanerkennung, Visabearbeitung und kulturelle Integration.</p>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                <h4 style="margin: 0 0 5px 0;">Bereit für die Rekrutierung?</h4>
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Fragen Sie noch heute Ihren NSL-Account-Manager nach Ihrem sicheren Zugangscode.</p>
                <div style="background: var(--nsl-gold); color: var(--nsl-dark); padding: 12px 25px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 5px 15px rgba(255,193,7,0.3);">
                    Login: www.personalkampagne-portal.de
                </div>
            </div>
        </div>
        <div class="col-right" style="background: var(--nsl-red); display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden;">
            <div class="bg-pattern"></div>
            <img src="/images/marketing/setcard_modal.png" class="screenshot" alt="Setcard View" style="transform: perspective(1000px) rotateY(5deg) scale(1.05); border: 4px solid white; position: relative; z-index: 2;">
            <div style="background: white; padding: 15px 30px; border-radius: 50px; font-weight: 800; font-size: 18px; color: var(--nsl-red); box-shadow: 0 10px 20px rgba(0,0,0,0.2); position: relative; z-index: 3; transform: translateY(15px);">
                Umfassende Setcards
            </div>
        </div>
    </div>
</body>
</html>`;

function updateFile(filePath, newContent) {
    const content = fs.readFileSync(filePath, 'utf8');
    const index = content.indexOf('<!-- PAGE 2:');
    if (index !== -1) {
        const result = content.substring(0, index) + newContent;
        fs.writeFileSync(filePath, result);
        console.log('Updated ' + filePath);
    } else {
        console.log('Could not find PAGE 2 in ' + filePath);
    }
}

updateFile(enFile, newENContent);
updateFile(deFile, newDEContent);
