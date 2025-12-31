import OAuth from 'oauth-1.0a';
import * as crypto from 'crypto';
import { supabaseAdmin } from './supabase';
import { createSession } from './session';

interface NetSuiteEmployee {
  empid: string;  // NetSuite employee ID
  name: string;  // Full name
  pawsUsername: string;
  pawsPassword: string;
  custentity_pir_emp_admin_rights: boolean;  // Admin flag
}

interface NetSuiteResponse {
  employees: NetSuiteEmployee[];
}

/**
 * Generates OAuth 1.0a signature for NetSuite API request
 */
function generateOAuthHeader(url: string, method: string = 'GET'): string {
  const oauth = new OAuth({
    consumer: {
      key: process.env.NETSUITE_CONSUMER_KEY!,
      secret: process.env.NETSUITE_CONSUMER_SECRET!,
    },
    signature_method: 'HMAC-SHA256',
    hash_function(baseString: string, key: string): string {
      return crypto.createHmac('sha256', key).update(baseString).digest('base64');
    },
  });

  const token = {
    key: process.env.NETSUITE_TOKEN_ID!,
    secret: process.env.NETSUITE_TOKEN_SECRET!,
  };

  const requestData = {
    url,
    method,
  };

  const authData = oauth.authorize(requestData, token);
  
  // Add realm parameter to the header (NetSuite requires realm before OAuth params)
  const header = oauth.toHeader(authData);
  const realm = process.env.NETSUITE_REALM || '7913744';
  // Header format: OAuth realm="7913744",oauth_consumer_key=...
  return header.Authorization.replace('OAuth ', `OAuth realm="${realm}",`);
}

/**
 * Authenticates user against NetSuite Restlet API
 * Returns user data if valid, null otherwise
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ success: true; isAdmin: boolean; userId: string } | { success: false; error: string; details?: any }> {
  try {
    const restletUrl = 'https://7913744.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2276&deploy=1';
    const authHeader = generateOAuthHeader(restletUrl, 'GET');

    const response = await fetch(restletUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      return { 
        success: false, 
        error: `Failed to authenticate with NetSuite (${response.status}: ${response.statusText})`,
        details: { status: response.status, statusText: response.statusText, body: responseText }
      };
    }

    let data: NetSuiteResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[NetSuite Auth] JSON parse error:', parseError);
      return { 
        success: false, 
        error: 'Invalid JSON response from NetSuite',
        details: { rawResponse: responseText }
      };
    }

    if (!data.employees || !Array.isArray(data.employees)) {
      return { 
        success: false, 
        error: 'Invalid response from NetSuite - employees array not found',
        details: { receivedData: data }
      };
    }

    // Find matching user by username
    const employee = data.employees.find(
      (emp) => emp.pawsUsername.toLowerCase() === username.toLowerCase()
    );

    if (!employee) {
      return { 
        success: false, 
        error: 'Invalid username or password',
        details: { searchedUsername: username, availableUsernames: data.employees.map(e => e.pawsUsername) }
      };
    }

    // Compare password directly (plaintext comparison as specified)
    if (employee.pawsPassword !== password) {
      return { 
        success: false, 
        error: 'Invalid username or password',
        details: { passwordMatch: false }
      };
    }

    // Upsert user into Supabase
    const { data: userData, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          netsuite_id: employee.empid,  // Use empid from NetSuite response
          username: employee.pawsUsername,
          full_name: employee.name || employee.pawsUsername,  // Use name from NetSuite response
          is_admin: employee.custentity_pir_emp_admin_rights || false,  // Use custentity_pir_emp_admin_rights
          last_login: new Date().toISOString(),
        },
        {
          onConflict: 'netsuite_id',
        }
      )
      .select()
      .single();

    if (upsertError || !userData) {
      console.error('Error upserting user:', upsertError);
      return { success: false, error: 'Failed to create user session' };
    }

    // Create session cookie
    await createSession({
      userId: userData.id,
      username: userData.username,
      isAdmin: userData.is_admin,
      netsuiteId: userData.netsuite_id,
    });

    return {
      success: true,
      isAdmin: userData.is_admin,
      userId: userData.id,
    };
  } catch (error) {
    console.error('[NetSuite Auth] Exception:', error);
    if (error instanceof Error) {
      console.error('[NetSuite Auth] Error message:', error.message);
      console.error('[NetSuite Auth] Error stack:', error.stack);
    }
    console.error('[NetSuite Auth] Authentication failed:', error);
    return { 
      success: false, 
      error: 'Authentication failed',
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

