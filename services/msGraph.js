const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
    auth: {
        clientId: process.env.MS_GRAPH_CLIENT_ID || 'dummy_client_id',
        authority: `https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID || 'dummy_tenant'}`,
        clientSecret: process.env.MS_GRAPH_CLIENT_SECRET || 'dummy_secret',
    }
};

const cca = new ConfidentialClientApplication(msalConfig);

async function getGraphToken() {
    const clientCredentialRequest = {
        scopes: ["https://graph.microsoft.com/.default"],
    };
    try {
        const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
        return response.accessToken;
    } catch (e) {
        throw new Error('Graph token acquisition failed. Please check MS_GRAPH_CLIENT_ID and secret in .env');
    }
}

function getGraphClient(token) {
    return Client.init({
        authProvider: (done) => {
            done(null, token);
        }
    });
}

async function fetchCandidateFilesFromMS365(query) {
    try {
        if (!process.env.MS_GRAPH_CLIENT_ID) {
            console.log('Chưa cấu hình MS Graph, trả về data mẫu (mock data).');
            return [ { source: 'SharePoint', fileName: `${query}_MS365_CV.pdf`, url: 'https://sharepoint.com/mock-cv' } ];
        }
        
        const token = await getGraphToken();
        const client = getGraphClient(token);
        
        // Ví dụ query search trên SharePoint / OneDrive:
        // const result = await client.api(`/sites/{site-id}/drive/root/search(q='${query}')`).get();
        // return result.value;
        
        return [ { source: 'SharePoint', fileName: `${query}_MS365_CV.pdf`, url: 'https://sharepoint.com/mock-cv' } ];
    } catch (error) {
        console.warn('⚠️ MS365 fetch fail:', error.message);
        return [];
    }
}

module.exports = { fetchCandidateFilesFromMS365 };
