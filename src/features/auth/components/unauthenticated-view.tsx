import { ShieldAlertIcon } from "lucide-react"; 

import { Item,
        ItemActions,
        ItemContent,
        ItemDescription,
        ItemMedia,
        ItemTitle,
} from "@/components/ui/item";
import { SignInButton} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sign } from "crypto";

export const UnauthenticatedView = () => {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
            <div className="w-full max-w-lg bg-muted">
                <Item variant = "outline" >
                    <ItemMedia>
                        <ShieldAlertIcon/>
                    </ItemMedia>
                    <ItemContent>
                        <ItemTitle>
                            Unauthorized Access
                        </ItemTitle>
                        <ItemDescription>
                            You must be signed in to access this resource. Please sign in or create an account to continue.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <SignInButton>
                            <Button variant="outline" size="sm">Sign In</Button>
                        </SignInButton>
                    </ItemActions>
                </Item>
            </div>
        </div>
    );
}